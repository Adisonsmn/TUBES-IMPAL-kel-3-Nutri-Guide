// ============================================================
// RIWAYAT MAKANAN CONTROLLER
// Methods: simpanRiwayat(), cekDuplikasi()
// ============================================================

import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

/**
 * GET /api/riwayat
 * Mengambil riwayat makanan user
 */
export const getRiwayat = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { tanggal, limit = 20 } = req.query;

  let query = supabase
    .from('riwayat_makanan')
    .select(`
      riwayat_id,
      tanggal_konsumsi,
      makanan:makanan_id (
        makanan_id,
        nama_makanan,
        kalori,
        protein,
        karbohidrat,
        lemak,
        harga_per_porsi
      )
    `)
    .eq('user_id', userId)
    .order('tanggal_konsumsi', { ascending: false })
    .limit(Number(limit));

  if (tanggal) {
    const tglMulai = `${tanggal}T00:00:00`;
    const tglAkhir = `${tanggal}T23:59:59`;
    query = query.gte('tanggal_konsumsi', tglMulai).lte('tanggal_konsumsi', tglAkhir);
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: 'Gagal mengambil riwayat makanan' });
    return;
  }

  // Hitung total kalori hari ini
  const totalKalori = data?.reduce((sum: number, r: any) => {
    return sum + (r.makanan?.kalori ?? 0);
  }, 0);

  res.status(200).json({
    riwayat: data,
    totalKalori,
    jumlahEntri: data?.length ?? 0,
  });
};

/**
 * POST /api/riwayat
 * Menyimpan riwayat konsumsi makanan (simpanRiwayat)
 */
export const simpanRiwayat = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { makananId, tanggalKonsumsi } = req.body;

  if (!makananId) {
    res.status(400).json({ error: 'makananId wajib diisi' });
    return;
  }

  // Validasi makanan ada
  const { data: makanan, error: makananError } = await supabase
    .from('makanan')
    .select('makanan_id, nama_makanan, kalori')
    .eq('makanan_id', makananId)
    .single();

  if (makananError || !makanan) {
    res.status(404).json({ error: 'Makanan tidak ditemukan' });
    return;
  }

  // Cek duplikasi sebelum simpan
  const waktuKonsumsi = tanggalKonsumsi
    ? new Date(tanggalKonsumsi).toISOString()
    : new Date().toISOString();

  const isDuplikat = await cekDuplikasiInternal(userId, makananId, waktuKonsumsi);
  if (isDuplikat) {
    res.status(409).json({
      error: 'Duplikat terdeteksi: makanan ini sudah dicatat dalam 30 menit terakhir',
      isDuplikat: true,
    });
    return;
  }

  const { data, error } = await supabase
    .from('riwayat_makanan')
    .insert({
      user_id: userId,
      makanan_id: makananId,
      tanggal_konsumsi: waktuKonsumsi,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Gagal menyimpan riwayat' });
    return;
  }

  res.status(201).json({
    message: 'Riwayat berhasil disimpan',
    riwayat: {
      riwayatId: data.riwayat_id,
      makanan: makanan.nama_makanan,
      kalori: makanan.kalori,
      tanggalKonsumsi: data.tanggal_konsumsi,
    },
  });
};

/**
 * GET /api/riwayat/cek-duplikasi
 * Mengecek apakah makanan sudah dicatat dalam waktu berdekatan (cekDuplikasi)
 */
export const cekDuplikasi = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { makananId, tanggalKonsumsi } = req.query;

  if (!makananId) {
    res.status(400).json({ error: 'makananId wajib diisi' });
    return;
  }

  const waktu = tanggalKonsumsi
    ? new Date(tanggalKonsumsi as string).toISOString()
    : new Date().toISOString();

  const isDuplikat = await cekDuplikasiInternal(
    userId,
    makananId as string,
    waktu
  );

  res.status(200).json({
    makananId,
    waktuDicek: waktu,
    isDuplikat,
    pesan: isDuplikat
      ? 'Makanan ini sudah dicatat dalam 30 menit terakhir'
      : 'Tidak ada duplikasi ditemukan',
  });
};

// ---- Helper internal ----
async function cekDuplikasiInternal(
  userId: string,
  makananId: string,
  waktuKonsumsi: string
): Promise<boolean> {
  const waktu = new Date(waktuKonsumsi);
  const tigaPuluhMenitLalu = new Date(waktu.getTime() - 30 * 60 * 1000);

  const { data } = await supabase
    .from('riwayat_makanan')
    .select('riwayat_id')
    .eq('user_id', userId)
    .eq('makanan_id', makananId)
    .gte('tanggal_konsumsi', tigaPuluhMenitLalu.toISOString())
    .lte('tanggal_konsumsi', waktu.toISOString());

  return (data?.length ?? 0) > 0;
}