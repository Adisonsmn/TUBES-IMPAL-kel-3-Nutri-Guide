// ============================================================
// PENGINGAT CONTROLLER
// Methods: kirimNotifikasi()
// ============================================================

import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

const JENIS_PENGINGAT_VALID = ['makan_pagi', 'makan_siang', 'makan_malam', 'minum_air', 'olahraga', 'timbang_badan'];

/**
 * GET /api/pengingat
 * Mengambil semua pengingat milik user
 */
export const getPengingat = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;

  const { data, error } = await supabase
    .from('pengingat')
    .select('*')
    .eq('user_id', userId)
    .order('waktu', { ascending: true });

  if (error) {
    res.status(500).json({ error: 'Gagal mengambil pengingat' });
    return;
  }

  res.status(200).json({ pengingat: data });
};

/**
 * POST /api/pengingat
 * Membuat pengingat baru
 */
export const createPengingat = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { jenisPengingat, waktu } = req.body;

  if (!jenisPengingat || !waktu) {
    res.status(400).json({ error: 'jenisPengingat dan waktu wajib diisi' });
    return;
  }

  if (!JENIS_PENGINGAT_VALID.includes(jenisPengingat)) {
    res.status(400).json({
      error: `jenisPengingat tidak valid. Pilihan: ${JENIS_PENGINGAT_VALID.join(', ')}`,
    });
    return;
  }

  const { data, error } = await supabase
    .from('pengingat')
    .insert({
      user_id: userId,
      jenis_pengingat: jenisPengingat,
      waktu: new Date(waktu).toISOString(),
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Gagal membuat pengingat' });
    return;
  }

  res.status(201).json({
    message: 'Pengingat berhasil dibuat',
    pengingat: {
      pengingatId: data.pengingat_id,
      jenisPengingat: data.jenis_pengingat,
      waktu: data.waktu,
    },
  });
};

/**
 * POST /api/pengingat/:pengingatId/kirim-notifikasi
 * Mengirim notifikasi untuk pengingat tertentu (kirimNotifikasi)
 * Pada implementasi nyata, ini akan trigger push notification / email
 */
export const kirimNotifikasi = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { pengingatId } = req.params;

  // Ambil data pengingat
  const { data: pengingat, error } = await supabase
    .from('pengingat')
    .select('*')
    .eq('pengingat_id', pengingatId)
    .eq('user_id', userId)
    .single();

  if (error || !pengingat) {
    res.status(404).json({ error: 'Pengingat tidak ditemukan' });
    return;
  }

  // Ambil data user untuk notifikasi
  const { data: userData } = await supabase.auth.admin.getUserById(userId);

  // Buat pesan notifikasi berdasarkan jenis pengingat
  const pesanNotifikasi: Record<string, string> = {
    makan_pagi: '🌅 Saatnya sarapan! Mulai hari dengan nutrisi yang baik.',
    makan_siang: '☀️ Waktunya makan siang! Jangan lewatkan makan siangmu.',
    makan_malam: '🌙 Saatnya makan malam. Pilih makanan yang ringan dan bergizi.',
    minum_air: '💧 Jangan lupa minum air! Targetmu 8 gelas per hari.',
    olahraga: '🏃 Waktunya bergerak! Olahraga ringan 30 menit sehari.',
    timbang_badan: '⚖️ Catat berat badanmu hari ini untuk tracking progress.',
  };

  const pesan = pesanNotifikasi[pengingat.jenis_pengingat] ?? 'Waktunya melakukan aktivitas sehatmu!';

  // Simpan log notifikasi yang sudah dikirim
  const { error: logError } = await supabase.from('motivasi').insert({
    user_id: userId,
    konten: pesan,
    waktu_kirim: new Date().toISOString(),
  });

  if (logError) {
    res.status(500).json({ error: 'Gagal mencatat notifikasi' });
    return;
  }

  // Di sini bisa diintegrasikan dengan: FCM, OneSignal, Email, WhatsApp API, dll
  // Contoh: await sendPushNotification(userData.user.email, pesan);

  res.status(200).json({
    message: 'Notifikasi berhasil dikirim',
    notifikasi: {
      pengingatId,
      jenisPengingat: pengingat.jenis_pengingat,
      pesan,
      dikirimKe: userData?.user?.email ?? userId,
      waktuKirim: new Date().toISOString(),
    },
  });
};

/**
 * DELETE /api/pengingat/:pengingatId
 * Menghapus pengingat
 */
export const deletePengingat = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { pengingatId } = req.params;

  const { error } = await supabase
    .from('pengingat')
    .delete()
    .eq('pengingat_id', pengingatId)
    .eq('user_id', userId);

  if (error) {
    res.status(500).json({ error: 'Gagal menghapus pengingat' });
    return;
  }

  res.status(200).json({ message: 'Pengingat berhasil dihapus' });
};