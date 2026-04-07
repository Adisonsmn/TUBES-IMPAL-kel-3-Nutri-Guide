// ============================================================
// PREFERENSI CONTROLLER
// Methods: filterRekomendasiByPreferensi()
// ============================================================

import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

/**
 * GET /api/preferensi
 * Mengambil semua preferensi user
 */
export const getPreferensi = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;

  const { data, error } = await supabase
    .from('preferensi')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    res.status(500).json({ error: 'Gagal mengambil preferensi' });
    return;
  }

  res.status(200).json({ preferensi: data });
};

/**
 * POST /api/preferensi
 * Menambahkan preferensi makanan baru
 */
export const addPreferensi = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { namaPreferensi } = req.body;

  if (!namaPreferensi) {
    res.status(400).json({ error: 'namaPreferensi wajib diisi' });
    return;
  }

  // Cek duplikasi preferensi
  const { data: existing } = await supabase
    .from('preferensi')
    .select('preferensi_id')
    .eq('user_id', userId)
    .ilike('nama_preferensi', namaPreferensi)
    .single();

  if (existing) {
    res.status(409).json({ error: 'Preferensi ini sudah ditambahkan sebelumnya' });
    return;
  }

  const { data, error } = await supabase
    .from('preferensi')
    .insert({
      user_id: userId,
      nama_preferensi: namaPreferensi,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Gagal menambahkan preferensi' });
    return;
  }

  res.status(201).json({
    message: 'Preferensi berhasil ditambahkan',
    preferensi: {
      preferensiId: data.preferensi_id,
      namaPreferensi: data.nama_preferensi,
    },
  });
};

/**
 * GET /api/preferensi/filter-rekomendasi
 * Memfilter rekomendasi makanan berdasarkan semua preferensi user (filterRekomendasiByPreferensi)
 */
export const filterRekomendasiByPreferensi = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;

  // Ambil semua preferensi user
  const { data: preferensiList, error: prefError } = await supabase
    .from('preferensi')
    .select('nama_preferensi')
    .eq('user_id', userId);

  if (prefError) {
    res.status(500).json({ error: 'Gagal mengambil preferensi' });
    return;
  }

  if (!preferensiList || preferensiList.length === 0) {
    // Kalau tidak ada preferensi, kembalikan semua makanan
    const { data: allMakanan } = await supabase
      .from('makanan')
      .select('*')
      .order('nama_makanan', { ascending: true })
      .limit(20);

    res.status(200).json({
      pesan: 'Belum ada preferensi. Menampilkan semua makanan.',
      preferensiAktif: [],
      makanan: allMakanan ?? [],
    });
    return;
  }

  const namaPreferensi = preferensiList.map((p: any) => p.nama_preferensi);

  // Build OR filter: cari makanan yang mengandung salah satu kata kunci preferensi
  const orFilter = namaPreferensi
    .map((p: string) => `nama_makanan.ilike.%${p}%`)
    .join(',');

  const { data: makananSesuai, error: makananError } = await supabase
    .from('makanan')
    .select('*')
    .or(orFilter)
    .order('nama_makanan', { ascending: true });

  if (makananError) {
    res.status(500).json({ error: 'Gagal memfilter makanan berdasarkan preferensi' });
    return;
  }

  // Skor relevansi: makanan yang cocok lebih banyak preferensi dapat skor lebih tinggi
  const makananDenganSkor = (makananSesuai ?? []).map((makanan: any) => {
    const skor = namaPreferensi.filter((p: string) =>
      makanan.nama_makanan.toLowerCase().includes(p.toLowerCase())
    ).length;
    return { ...makanan, skorRelevansi: skor };
  });

  makananDenganSkor.sort((a: any, b: any) => b.skorRelevansi - a.skorRelevansi);

  res.status(200).json({
    preferensiAktif: namaPreferensi,
    jumlahPreferensi: namaPreferensi.length,
    makanan: makananDenganSkor,
    jumlahMakanan: makananDenganSkor.length,
  });
};

/**
 * DELETE /api/preferensi/:preferensiId
 * Menghapus preferensi
 */
export const deletePreferensi = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { preferensiId } = req.params;

  const { error } = await supabase
    .from('preferensi')
    .delete()
    .eq('preferensi_id', preferensiId)
    .eq('user_id', userId);

  if (error) {
    res.status(500).json({ error: 'Gagal menghapus preferensi' });
    return;
  }

  res.status(200).json({ message: 'Preferensi berhasil dihapus' });
};