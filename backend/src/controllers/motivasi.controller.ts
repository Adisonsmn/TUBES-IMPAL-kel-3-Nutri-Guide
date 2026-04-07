// ============================================================
// MOTIVASI CONTROLLER
// Methods: kirimMotivasi()
// ============================================================

import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Kumpulan konten motivasi default berdasarkan tujuan kesehatan
const MOTIVASI_TEMPLATE: Record<string, string[]> = {
  turun_berat: [
    'Setiap langkah kecil membawamu lebih dekat ke tujuan. Tetap semangat!',
    'Konsistensi adalah kuncinya. Kamu sudah melakukan yang terbaik hari ini!',
    'Progress, bukan kesempurnaan. Terus bergerak maju!',
  ],
  naik_berat: [
    'Tubuhmu sedang tumbuh lebih kuat. Nikmati prosesnya!',
    'Nutrisi yang baik adalah investasi terbaik untuk dirimu.',
    'Setiap kalori yang kamu konsumsi adalah bahan bakar masa depanmu!',
  ],
  hidup_sehat: [
    'Kesehatan adalah mahkota yang hanya terlihat oleh mereka yang sakit.',
    'Makanan sehat hari ini adalah energi terbaikmu esok hari.',
    'Kamu sudah memilih hidup sehat — itu keputusan terbaik!',
  ],
  default: [
    'Jaga kesehatanmu, karena tubuh yang sehat adalah fondasi segalanya.',
    'Satu pilihan makanan sehat setiap hari mengubah hidupmu!',
    'Tetap konsisten dan percaya pada prosesmu.',
  ],
};

/**
 * POST /api/motivasi/kirim
 * Mengirim pesan motivasi ke user berdasarkan tujuan kesehatannya (kirimMotivasi)
 */
export const kirimMotivasi = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  const { kontenKustom } = req.body;

  // Ambil tujuan kesehatan user untuk personalisasi
  const { data: profil } = await supabase
    .from('profil_pribadi')
    .select('tujuan_kesehatan')
    .eq('user_id', userId)
    .single();

  const tujuan = profil?.tujuan_kesehatan ?? 'default';
  const templates = MOTIVASI_TEMPLATE[tujuan] ?? MOTIVASI_TEMPLATE['default'];

  // Pilih konten: pakai kustom atau ambil random dari template
  const konten =
    kontenKustom ?? templates[Math.floor(Math.random() * templates.length)];

  const { data, error } = await supabase
    .from('motivasi')
    .insert({
      user_id: userId,
      konten,
      waktu_kirim: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: 'Gagal mengirim motivasi' });
    return;
  }

  res.status(201).json({
    message: 'Motivasi berhasil dikirim',
    motivasi: {
      motivasiId: data.motivasi_id,
      konten: data.konten,
      waktuKirim: data.waktu_kirim,
    },
  });
};

/**
 * GET /api/motivasi
 * Mengambil riwayat motivasi yang sudah dikirim ke user
 */
export const getRiwayatMotivasi = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;

  const { data, error } = await supabase
    .from('motivasi')
    .select('*')
    .eq('user_id', userId)
    .order('waktu_kirim', { ascending: false })
    .limit(20);

  if (error) {
    res.status(500).json({ error: 'Gagal mengambil riwayat motivasi' });
    return;
  }

  res.status(200).json({ motivasi: data });
};

/**
 * POST /api/motivasi/kirim-terjadwal
 * Mengirim motivasi ke semua user aktif (dipanggil oleh cron job / scheduler)
 * Endpoint ini hanya bisa diakses dengan service role key
 */
export const kirimMotivasiTerjadwal = async (req: Request, res: Response): Promise<void> => {
  const serviceKey = req.headers['x-service-key'];

  if (serviceKey !== process.env.SERVICE_CRON_KEY) {
    res.status(403).json({ error: 'Tidak diizinkan' });
    return;
  }

  // Ambil semua user yang punya profil
  const { data: profils, error } = await supabase
    .from('profil_pribadi')
    .select('user_id, tujuan_kesehatan');

  if (error || !profils) {
    res.status(500).json({ error: 'Gagal mengambil daftar user' });
    return;
  }

  const motivasiList = profils.map((profil: any) => {
    const tujuan = profil.tujuan_kesehatan ?? 'default';
    const templates = MOTIVASI_TEMPLATE[tujuan] ?? MOTIVASI_TEMPLATE['default'];
    const konten = templates[Math.floor(Math.random() * templates.length)];
    return {
      user_id: profil.user_id,
      konten,
      waktu_kirim: new Date().toISOString(),
    };
  });

  const { error: insertError } = await supabase
    .from('motivasi')
    .insert(motivasiList);

  if (insertError) {
    res.status(500).json({ error: 'Gagal mengirim motivasi terjadwal' });
    return;
  }

  res.status(200).json({
    message: `Motivasi berhasil dikirim ke ${motivasiList.length} user`,
    total: motivasiList.length,
  });
};