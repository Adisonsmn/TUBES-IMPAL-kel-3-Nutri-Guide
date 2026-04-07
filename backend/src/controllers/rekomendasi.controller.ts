// ============================================================
// REKOMENDASI CONTROLLER
// Methods: lihatKebutuhanKalori(), generateRekomendasi(),
//          filterByAnggaran(), filterByReferensi()
// ============================================================

import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

/**
 * GET /api/rekomendasi/kebutuhan-kalori
 * Melihat kebutuhan kalori user berdasarkan profil (lihatKebutuhanKalori)
 */
export const lihatKebutuhanKalori = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;

  const { data: profil, error } = await supabase
    .from('profil_pribadi')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !profil) {
    res.status(404).json({ error: 'Profil tidak ditemukan' });
    return;
  }

  let bmr: number;
  if (profil.gender === 'laki-laki') {
    bmr = 88.36 + 13.4 * profil.berat + 4.8 * profil.tinggi - 5.7 * profil.umur;
  } else {
    bmr = 447.6 + 9.2 * profil.berat + 3.1 * profil.tinggi - 4.3 * profil.umur;
  }

  const tdee = Math.round(bmr * 1.55);

  // Ambil rekomendasi terbaru user
  const { data: rekTerbaru } = await supabase
    .from('rekomendasi')
    .select('*')
    .eq('user_id', userId)
    .order('tanggal', { ascending: false })
    .limit(1)
    .single();

  res.status(200).json({
    kebutuhanKaloriHarian: tdee,
    bmr: Math.round(bmr),
    rekomendasiTerbaru: rekTerbaru
      ? {
          rekomendasiId: rekTerbaru.rekomendasi_id,
          tanggal: rekTerbaru.tanggal,
          totalKalori: rekTerbaru.total_kalori,
        }
      : null,
  });
};

/**
 * POST /api/rekomendasi/generate
 * Membuat rekomendasi makanan baru berdasarkan profil, preferensi, anggaran
 */
export const generateRekomendasi = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;

  // 1. Ambil profil
  const { data: profil, error: profilError } = await supabase
    .from('profil_pribadi')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (profilError || !profil) {
    res.status(404).json({ error: 'Lengkapi profil terlebih dahulu' });
    return;
  }

  // 2. Hitung target kalori
  let bmr: number;
  if (profil.gender === 'laki-laki') {
    bmr = 88.36 + 13.4 * profil.berat + 4.8 * profil.tinggi - 5.7 * profil.umur;
  } else {
    bmr = 447.6 + 9.2 * profil.berat + 3.1 * profil.tinggi - 4.3 * profil.umur;
  }
  let targetKalori = Math.round(bmr * 1.55);
  if (profil.tujuan_kesehatan === 'turun_berat') targetKalori -= 500;
  if (profil.tujuan_kesehatan === 'naik_berat') targetKalori += 500;

  // 3. Ambil preferensi
  const { data: preferensiList } = await supabase
    .from('preferensi')
    .select('nama_preferensi')
    .eq('user_id', userId);

  // 4. Ambil anggaran aktif
  const { data: anggaran } = await supabase
    .from('anggaran')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const anggaranPerMakan = anggaran
    ? Math.floor(anggaran.jumlah_anggaran / 3)
    : null;

  // 5. Query makanan yang sesuai
  let makananQuery = supabase
    .from('makanan')
    .select('*')
    .lte('kalori', targetKalori * 0.4); // max 40% kalori harian per makanan

  if (anggaranPerMakan) {
    makananQuery = makananQuery.lte('harga_per_porsi', anggaranPerMakan);
  }

  // Filter by preferensi (misal vegetarian, bebas gluten, dll)
  if (preferensiList && preferensiList.length > 0) {
    const namaPreferensi = preferensiList.map((p: any) => p.nama_preferensi);
    // Filter nama makanan yang mengandung kata kunci preferensi
    makananQuery = makananQuery.or(
      namaPreferensi.map((p: string) => `nama_makanan.ilike.%${p}%`).join(',')
    );
  }

  const { data: makananList, error: makananError } = await makananQuery.limit(10);

  if (makananError) {
    res.status(500).json({ error: 'Gagal generate rekomendasi' });
    return;
  }

  // 6. Simpan rekomendasi ke database
  const { data: rekBaru, error: rekError } = await supabase
    .from('rekomendasi')
    .insert({
      user_id: userId,
      tanggal: new Date().toISOString().split('T')[0],
      total_kalori: targetKalori,
    })
    .select()
    .single();

  if (rekError) {
    res.status(500).json({ error: 'Gagal menyimpan rekomendasi' });
    return;
  }

  res.status(201).json({
    rekomendasiId: rekBaru.rekomendasi_id,
    tanggal: rekBaru.tanggal,
    targetKaloriHarian: targetKalori,
    tujuanKesehatan: profil.tujuan_kesehatan,
    anggaranPerMakan,
    makananDisarankan: makananList,
    jumlahMakanan: makananList?.length ?? 0,
  });
};

/**
 * GET /api/rekomendasi/filter-anggaran
 * Filter rekomendasi berdasarkan batas anggaran (filterByAnggaran)
 */
export const filterByAnggaran = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { maxHarga } = req.query;

  if (!maxHarga) {
    res.status(400).json({ error: 'Parameter maxHarga wajib diisi' });
    return;
  }

  const hargaMax = Number(maxHarga);

  const { data, error } = await supabase
    .from('makanan')
    .select('*')
    .lte('harga_per_porsi', hargaMax)
    .order('harga_per_porsi', { ascending: true });

  if (error) {
    res.status(500).json({ error: 'Gagal memfilter makanan' });
    return;
  }

  // Cek anggaran user
  const { data: anggaran } = await supabase
    .from('anggaran')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  res.status(200).json({
    maxHargaFilter: hargaMax,
    anggaranTerdaftar: anggaran?.jumlah_anggaran ?? null,
    periode: anggaran?.periode ?? null,
    jumlahMakanan: data?.length ?? 0,
    makanan: data,
  });
};

/**
 * GET /api/rekomendasi/filter-referensi
 * Filter rekomendasi berdasarkan referensi/riwayat makan user (filterByReferensi)
 */
export const filterByReferensi = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;

  // Ambil riwayat makanan 7 hari terakhir
  const tujuhHariLalu = new Date();
  tujuhHariLalu.setDate(tujuhHariLalu.getDate() - 7);

  const { data: riwayat, error: riwayatError } = await supabase
    .from('riwayat_makanan')
    .select(`
      makanan_id,
      makanan:makanan_id (
        makanan_id,
        nama_makanan,
        kalori,
        protein,
        harga_per_porsi
      )
    `)
    .eq('user_id', userId)
    .gte('tanggal_konsumsi', tujuhHariLalu.toISOString());

  if (riwayatError) {
    res.status(500).json({ error: 'Gagal mengambil riwayat' });
    return;
  }

  // Hitung frekuensi makanan yang sering dikonsumsi
  const frekuensiMap: Record<string, { makanan: any; jumlah: number }> = {};
  riwayat?.forEach((r: any) => {
    const id = r.makanan_id;
    if (!frekuensiMap[id]) {
      frekuensiMap[id] = { makanan: r.makanan, jumlah: 0 };
    }
    frekuensiMap[id].jumlah += 1;
  });

  const makananFavorit = Object.values(frekuensiMap)
    .sort((a, b) => b.jumlah - a.jumlah)
    .slice(0, 5);

  // Rekomendasikan makanan sejenis berdasarkan range kalori yang sama
  const kaloriRange = makananFavorit.map((m) => m.makanan?.kalori ?? 0);
  const avgKalori =
    kaloriRange.length > 0
      ? kaloriRange.reduce((a, b) => a + b, 0) / kaloriRange.length
      : 300;

  const { data: rekomendasiSerupa } = await supabase
    .from('makanan')
    .select('*')
    .gte('kalori', avgKalori * 0.7)
    .lte('kalori', avgKalori * 1.3)
    .not(
      'makanan_id',
      'in',
      `(${Object.keys(frekuensiMap).join(',')})`
    )
    .limit(8);

  res.status(200).json({
    makananFavoritMingguIni: makananFavorit,
    rekomendasiSerupa: rekomendasiSerupa ?? [],
  });
};