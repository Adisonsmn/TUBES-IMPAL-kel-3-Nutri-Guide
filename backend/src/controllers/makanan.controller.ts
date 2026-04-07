// ============================================================
// MAKANAN CONTROLLER
// Methods: getInformasiGizi()
// ============================================================

import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

/**
 * GET /api/makanan
 * Mengambil daftar semua makanan (dengan optional filter nama)
 */
export const getAllMakanan = async (req: Request, res: Response): Promise<void> => {
  const { nama, minKalori, maxKalori, maxHarga } = req.query;

  let query = supabase.from('makanan').select('*');

  if (nama) {
    query = query.ilike('nama_makanan', `%${nama}%`);
  }
  if (minKalori) {
    query = query.gte('kalori', Number(minKalori));
  }
  if (maxKalori) {
    query = query.lte('kalori', Number(maxKalori));
  }
  if (maxHarga) {
    query = query.lte('harga_per_porsi', Number(maxHarga));
  }

  const { data, error } = await query.order('nama_makanan', { ascending: true });

  if (error) {
    res.status(500).json({ error: 'Gagal mengambil data makanan' });
    return;
  }

  res.status(200).json(data);
};

/**
 * GET /api/makanan/:makananId/informasi-gizi
 * Menampilkan informasi gizi lengkap dari sebuah makanan
 */
export const getInformasiGizi = async (req: Request, res: Response): Promise<void> => {
  const { makananId } = req.params;

  const { data, error } = await supabase
    .from('makanan')
    .select('*')
    .eq('makanan_id', makananId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Makanan tidak ditemukan' });
    return;
  }

  // Hitung persentase AKG (Angka Kecukupan Gizi) harian
  // Berdasarkan standar AKG dewasa Indonesia (Permenkes 2019)
  const akgHarian = {
    kalori: 2150,
    karbohidrat: 325,  // gram
    protein: 62,        // gram
    lemak: 67,          // gram
  };

  const persentaseAKG = {
    kalori: ((data.kalori / akgHarian.kalori) * 100).toFixed(1),
    karbohidrat: ((data.karbohidrat / akgHarian.karbohidrat) * 100).toFixed(1),
    protein: ((data.protein / akgHarian.protein) * 100).toFixed(1),
    lemak: ((data.lemak / akgHarian.lemak) * 100).toFixed(1),
  };

  res.status(200).json({
    makananId: data.makanan_id,
    namaMakanan: data.nama_makanan,
    hargaPerPorsi: data.harga_per_porsi,
    informasiGizi: {
      kalori: data.kalori,
      karbohidrat: data.karbohidrat,
      protein: data.protein,
      lemak: data.lemak,
      vitamin: data.vitamin,
      mineral: data.mineral,
    },
    persentaseAKG,
    label: {
      rendahKalori: data.kalori < 200,
      tinggiProtein: data.protein > 20,
      rendahLemak: data.lemak < 5,
    },
  });
};