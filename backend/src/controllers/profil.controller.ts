// ============================================================
// PROFIL PRIBADI CONTROLLER
// Methods: updateProfil(), hitungKebutuhanKalori()
// ============================================================

import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

/**
 * GET /api/profil
 * Mengambil data profil pribadi user
 */
export const getProfil = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;

  const { data, error } = await supabase
    .from('profil_pribadi')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    res.status(404).json({ error: 'Profil tidak ditemukan' });
    return;
  }

  res.status(200).json({
    userId: data.user_id,
    umur: data.umur,
    berat: data.berat,
    tinggi: data.tinggi,
    gender: data.gender,
    tujuanKesehatan: data.tujuan_kesehatan,
  });
};

/**
 * PUT /api/profil
 * Memperbarui data profil pribadi user
 */
export const updateProfil = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { umur, berat, tinggi, gender, tujuanKesehatan } = req.body;

  if (!umur || !berat || !tinggi || !gender || !tujuanKesehatan) {
    res.status(400).json({ error: 'Semua field profil wajib diisi' });
    return;
  }

  if (berat <= 0 || tinggi <= 0 || umur <= 0) {
    res.status(400).json({ error: 'Nilai berat, tinggi, dan umur harus positif' });
    return;
  }

  const { data, error } = await supabase
    .from('profil_pribadi')
    .upsert({
      user_id: userId,
      umur,
      berat,
      tinggi,
      gender,
      tujuan_kesehatan: tujuanKesehatan,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Gagal memperbarui profil' });
    return;
  }

  res.status(200).json({
    message: 'Profil berhasil diperbarui',
    profil: {
      userId: data.user_id,
      umur: data.umur,
      berat: data.berat,
      tinggi: data.tinggi,
      gender: data.gender,
      tujuanKesehatan: data.tujuan_kesehatan,
    },
  });
};

/**
 * GET /api/profil/kebutuhan-kalori
 * Menghitung kebutuhan kalori harian berdasarkan profil (Rumus Harris-Benedict)
 */
export const hitungKebutuhanKalori = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;

  const { data, error } = await supabase
    .from('profil_pribadi')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Profil tidak ditemukan. Lengkapi profil terlebih dahulu.' });
    return;
  }

  if (!data.umur || !data.berat || !data.tinggi || !data.gender) {
    res.status(400).json({ error: 'Data profil belum lengkap untuk menghitung kalori' });
    return;
  }

  // Rumus Harris-Benedict
  let bmr: number;
  if (data.gender === 'laki-laki') {
    bmr = 88.36 + 13.4 * data.berat + 4.8 * data.tinggi - 5.7 * data.umur;
  } else {
    bmr = 447.6 + 9.2 * data.berat + 3.1 * data.tinggi - 4.3 * data.umur;
  }

  // TDEE berdasarkan level aktivitas
  const levelAktivitas: Record<string, number> = {
    sedentary: 1.2,       // Tidak aktif / kerja kantoran
    ringan: 1.375,         // Olahraga ringan 1-3x/minggu
    sedang: 1.55,          // Olahraga sedang 3-5x/minggu
    aktif: 1.725,          // Olahraga berat 6-7x/minggu
    sangat_aktif: 1.9,     // Atlet / kerja fisik berat
  };

  const aktivitas = (req.query.aktivitas as string) ?? 'sedang';
  const multiplier = levelAktivitas[aktivitas] ?? 1.55;
  const tdee = Math.round(bmr * multiplier);

  // Kalori target berdasarkan tujuan
  let kaloriTarget = tdee;
  if (data.tujuan_kesehatan === 'turun_berat') kaloriTarget = tdee - 500;
  if (data.tujuan_kesehatan === 'naik_berat') kaloriTarget = tdee + 500;

  res.status(200).json({
    bmr: Math.round(bmr),
    tdee,
    kaloriTarget,
    tujuanKesehatan: data.tujuan_kesehatan,
    levelAktivitas: aktivitas,
    detail: {
      protein: Math.round((kaloriTarget * 0.3) / 4),   // gram
      karbohidrat: Math.round((kaloriTarget * 0.45) / 4), // gram
      lemak: Math.round((kaloriTarget * 0.25) / 9),       // gram
    },
  });
};