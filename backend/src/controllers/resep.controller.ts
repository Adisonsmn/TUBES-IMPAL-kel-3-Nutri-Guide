// ============================================================
// RESEP CONTROLLER
// Methods: lihatResep(), langkahMemasak()
// ============================================================

import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

/**
 * GET /api/resep
 * Mengambil semua resep beserta info makanannya
 */
export const getAllResep = async (req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabase
    .from('resep')
    .select(`
      resep_id,
      bahan,
      langkah_memasak,
      makanan:makanan_id (
        makanan_id,
        nama_makanan,
        kalori,
        harga_per_porsi
      )
    `);

  if (error) {
    res.status(500).json({ error: 'Gagal mengambil data resep' });
    return;
  }

  res.status(200).json(data);
};

/**
 * GET /api/resep/:resepId
 * Melihat detail lengkap sebuah resep (lihatResep)
 */
export const lihatResep = async (req: Request, res: Response): Promise<void> => {
  const { resepId } = req.params;

  const { data, error } = await supabase
    .from('resep')
    .select(`
      resep_id,
      bahan,
      langkah_memasak,
      makanan:makanan_id (
        makanan_id,
        nama_makanan,
        kalori,
        protein,
        karbohidrat,
        lemak,
        vitamin,
        mineral,
        harga_per_porsi
      )
    `)
    .eq('resep_id', resepId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Resep tidak ditemukan' });
    return;
  }

  // Parse bahan menjadi array (disimpan sebagai string dipisah newline)
  const bahanList = data.bahan
    ? data.bahan.split('\n').map((b: string) => b.trim()).filter(Boolean)
    : [];

  res.status(200).json({
    resepId: data.resep_id,
    makanan: data.makanan,
    bahan: bahanList,
    jumlahBahan: bahanList.length,
  });
};

/**
 * GET /api/resep/:resepId/langkah-memasak
 * Menampilkan langkah-langkah memasak secara terurut (langkahMemasak)
 */
export const langkahMemasak = async (req: Request, res: Response): Promise<void> => {
  const { resepId } = req.params;

  const { data, error } = await supabase
    .from('resep')
    .select(`
      resep_id,
      langkah_memasak,
      makanan:makanan_id ( nama_makanan )
    `)
    .eq('resep_id', resepId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Resep tidak ditemukan' });
    return;
  }

  // Parse langkah memasak menjadi array terurut
  const langkahList = data.langkah_memasak
    ? data.langkah_memasak
        .split('\n')
        .map((l: string) => l.trim())
        .filter(Boolean)
        .map((langkah: string, index: number) => ({
          nomor: index + 1,
          instruksi: langkah,
        }))
    : [];

  res.status(200).json({
    resepId: data.resep_id,
    namaMakanan: (data.makanan as any)?.nama_makanan ?? '',
    totalLangkah: langkahList.length,
    langkah: langkahList,
  });
};