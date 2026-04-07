// ============================================================
// ARTIKEL CONTROLLER
// Methods: tampilkanArtikel()
// ============================================================

import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

/**
 * GET /api/artikel
 * Menampilkan semua artikel (tampilkanArtikel - list)
 * Support filter & search
 */
export const tampilkanArtikel = async (req: Request, res: Response): Promise<void> => {
  const { cari, limit = 10, page = 1 } = req.query;

  const offset = (Number(page) - 1) * Number(limit);

  let query = supabase
    .from('artikel')
    .select('artikel_id, judul, tanggal_publikasi', { count: 'exact' })
    .order('tanggal_publikasi', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (cari) {
    query = query.ilike('judul', `%${cari}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    res.status(500).json({ error: 'Gagal mengambil artikel' });
    return;
  }

  res.status(200).json({
    artikel: data,
    total: count,
    page: Number(page),
    limit: Number(limit),
    totalHalaman: Math.ceil((count ?? 0) / Number(limit)),
  });
};

/**
 * GET /api/artikel/:artikelId
 * Menampilkan detail artikel lengkap beserta kontennya (tampilkanArtikel - detail)
 */
export const getArtikelById = async (req: Request, res: Response): Promise<void> => {
  const { artikelId } = req.params;

  const { data, error } = await supabase
    .from('artikel')
    .select('*')
    .eq('artikel_id', artikelId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Artikel tidak ditemukan' });
    return;
  }

  // Hitung estimasi waktu baca (asumsi 200 kata/menit)
  const jumlahKata = data.konten?.split(' ').length ?? 0;
  const estimasiMenit = Math.max(1, Math.ceil(jumlahKata / 200));

  res.status(200).json({
    artikelId: data.artikel_id,
    judul: data.judul,
    konten: data.konten,
    tanggalPublikasi: data.tanggal_publikasi,
    estimasiWaktuBaca: `${estimasiMenit} menit`,
    jumlahKata,
  });
};