// ============================================================
// ANGGARAN CONTROLLER
// Methods: validasiAnggaran(), filterRekomendasiByHarga()
// ============================================================

import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

/**
 * GET /api/anggaran
 * Mengambil data anggaran aktif user
 */
export const getAnggaran = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;

  const { data, error } = await supabase
    .from('anggaran')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: 'Gagal mengambil data anggaran' });
    return;
  }

  res.status(200).json({ anggaran: data });
};

/**
 * POST /api/anggaran
 * Membuat anggaran baru
 */
export const createAnggaran = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { jumlahAnggaran, periode } = req.body;

  if (!jumlahAnggaran || !periode) {
    res.status(400).json({ error: 'jumlahAnggaran dan periode wajib diisi' });
    return;
  }

  const periodeValid = ['harian', 'mingguan', 'bulanan'];
  if (!periodeValid.includes(periode)) {
    res.status(400).json({ error: `periode tidak valid. Pilihan: ${periodeValid.join(', ')}` });
    return;
  }

  const { data, error } = await supabase
    .from('anggaran')
    .insert({
      user_id: userId,
      jumlah_anggaran: jumlahAnggaran,
      periode,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Gagal menyimpan anggaran' });
    return;
  }

  res.status(201).json({
    message: 'Anggaran berhasil disimpan',
    anggaran: {
      anggaranId: data.anggaran_id,
      jumlahAnggaran: data.jumlah_anggaran,
      periode: data.periode,
    },
  });
};

/**
 * POST /api/anggaran/:anggaranId/validasi
 * Memvalidasi apakah pengeluaran makanan masih dalam batas anggaran (validasiAnggaran)
 */
export const validasiAnggaran = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { anggaranId } = req.params;
  const { pengeluaranBaru } = req.body;

  if (pengeluaranBaru === undefined) {
    res.status(400).json({ error: 'pengeluaranBaru wajib diisi' });
    return;
  }

  // Ambil data anggaran
  const { data: anggaran, error } = await supabase
    .from('anggaran')
    .select('*')
    .eq('anggaran_id', anggaranId)
    .eq('user_id', userId)
    .single();

  if (error || !anggaran) {
    res.status(404).json({ error: 'Anggaran tidak ditemukan' });
    return;
  }

  // Hitung total pengeluaran makanan dalam periode anggaran
  const sekarang = new Date();
  let tanggalMulai: Date;

  if (anggaran.periode === 'harian') {
    tanggalMulai = new Date(sekarang.toISOString().split('T')[0]);
  } else if (anggaran.periode === 'mingguan') {
    const hari = sekarang.getDay();
    tanggalMulai = new Date(sekarang);
    tanggalMulai.setDate(sekarang.getDate() - hari);
    tanggalMulai.setHours(0, 0, 0, 0);
  } else {
    // bulanan
    tanggalMulai = new Date(sekarang.getFullYear(), sekarang.getMonth(), 1);
  }

  const { data: riwayat } = await supabase
    .from('riwayat_makanan')
    .select(`makanan:makanan_id ( harga_per_porsi )`)
    .eq('user_id', userId)
    .gte('tanggal_konsumsi', tanggalMulai.toISOString());

  const totalPengeluaran = riwayat?.reduce((sum: number, r: any) => {
    return sum + (r.makanan?.harga_per_porsi ?? 0);
  }, 0) ?? 0;

  const totalDenganBaru = totalPengeluaran + pengeluaranBaru;
  const sisaAnggaran = anggaran.jumlah_anggaran - totalPengeluaran;
  const masihDalamAnggaran = totalDenganBaru <= anggaran.jumlah_anggaran;
  const persentaseTerpakai = ((totalDenganBaru / anggaran.jumlah_anggaran) * 100).toFixed(1);

  res.status(200).json({
    anggaranTotal: anggaran.jumlah_anggaran,
    periode: anggaran.periode,
    totalPengeluaranPeriodeIni: totalPengeluaran,
    pengeluaranBaru,
    totalSetelahPengeluaran: totalDenganBaru,
    sisaAnggaran: Math.max(0, sisaAnggaran),
    persentaseTerpakai: `${persentaseTerpakai}%`,
    masihDalamAnggaran,
    status: masihDalamAnggaran ? 'aman' : 'melebihi_anggaran',
    peringatan: !masihDalamAnggaran
      ? `Pengeluaran melebihi anggaran sebesar Rp ${(totalDenganBaru - anggaran.jumlah_anggaran).toLocaleString('id-ID')}`
      : null,
  });
};

/**
 * GET /api/anggaran/filter-rekomendasi
 * Memfilter rekomendasi makanan berdasarkan harga sesuai anggaran (filterRekomendasiByHarga)
 */
export const filterRekomendasiByHarga = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;

  // Ambil anggaran aktif user
  const { data: anggaran, error: anggaranError } = await supabase
    .from('anggaran')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (anggaranError || !anggaran) {
    res.status(404).json({ error: 'Belum ada anggaran yang diatur. Buat anggaran terlebih dahulu.' });
    return;
  }

  // Hitung batas harga per porsi berdasarkan periode
  const pembagi: Record<string, number> = {
    harian: 3,        // 3x makan sehari
    mingguan: 21,     // 3x makan × 7 hari
    bulanan: 90,      // 3x makan × 30 hari
  };

  const maxHargaPerPorsi = Math.floor(
    anggaran.jumlah_anggaran / (pembagi[anggaran.periode] ?? 3)
  );

  const { data: makanan, error: makananError } = await supabase
    .from('makanan')
    .select('*')
    .lte('harga_per_porsi', maxHargaPerPorsi)
    .order('harga_per_porsi', { ascending: true });

  if (makananError) {
    res.status(500).json({ error: 'Gagal memfilter rekomendasi' });
    return;
  }

  res.status(200).json({
    anggaran: {
      total: anggaran.jumlah_anggaran,
      periode: anggaran.periode,
      maxHargaPerPorsi,
    },
    makananTerjangkau: makanan,
    jumlahPilihan: makanan?.length ?? 0,
  });
};