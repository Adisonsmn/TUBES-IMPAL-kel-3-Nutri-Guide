import { Request, Response } from "express";
import { supabase } from "../config/supabase";
import { RegisterBody, LoginBody, UpdatePasswordBody } from "../models/types";

export const register = async (req: Request, res: Response): Promise<void> => {
  const { nama, email, password } = req.body as RegisterBody;

  if (!nama || !email || !password) {
    res.status(400).json({ error: "nama, email, dan password wajib diisi" });
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { nama },
    email_confirm: true,
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  // Buat profil awal kosong setelah register
  await supabase.from("profil_pribadi").insert({
    user_id: data.user.id,
    umur: null,
    berat: null,
    tinggi: null,
    gender: null,
    tujuan_kesehatan: null,
  });

  res.status(201).json({
    message: "Registrasi berhasil",
    user: {
      userId: data.user.id,
      nama,
      email: data.user.email,
      tanggalDaftar: data.user.created_at,
    },
  });
};

/**
 * POST /api/auth/login
 * Login user dan mengembalikan access token
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as LoginBody;

  if (!email || !password) {
    res.status(400).json({ error: "email dan password wajib diisi" });
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    res.status(401).json({ error: "Email atau password salah" });
    return;
  }

  res.status(200).json({
    message: "Login berhasil",
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: {
      userId: data.user.id,
      nama: data.user.user_metadata.nama,
      email: data.user.email,
    },
  });
};

/**
 * PUT /api/auth/update-password
 * Mengubah password user yang sedang login
 */
export const updatePassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { passwordBaru } = req.body as UpdatePasswordBody;
  const userId = (req as any).user.id;

  if (!passwordBaru || passwordBaru.length < 8) {
    res.status(400).json({ error: "Password baru minimal 8 karakter" });
    return;
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: passwordBaru,
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(200).json({ message: "Password berhasil diperbarui" });
};

/**
 * POST /api/auth/minta-rekomendasi
 * User meminta sistem membuat rekomendasi baru berdasarkan profil terkini
 */
export const memintaRekomendasi = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = (req as any).user.id;

  // Ambil profil user
  const { data: profil, error: profilError } = await supabase
    .from("profil_pribadi")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (profilError || !profil) {
    res
      .status(404)
      .json({
        error: "Profil belum dilengkapi. Lengkapi profil terlebih dahulu.",
      });
    return;
  }

  // Ambil preferensi user
  const { data: preferensiList } = await supabase
    .from("preferensi")
    .select("nama_preferensi")
    .eq("user_id", userId);

  // Ambil anggaran aktif
  const { data: anggaran } = await supabase
    .from("anggaran")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Hitung BMR sebagai total kalori target
  let bmr: number;
  if (profil.gender === "laki-laki") {
    bmr = 88.36 + 13.4 * profil.berat + 4.8 * profil.tinggi - 5.7 * profil.umur;
  } else {
    bmr = 447.6 + 9.2 * profil.berat + 3.1 * profil.tinggi - 4.3 * profil.umur;
  }
  const totalKalori = Math.round(bmr * 1.55);

  // Simpan rekomendasi baru
  const { data: rekomendasi, error: rekError } = await supabase
    .from("rekomendasi")
    .insert({
      user_id: userId,
      tanggal: new Date().toISOString().split("T")[0],
      total_kalori: totalKalori,
    })
    .select()
    .single();

  if (rekError) {
    res.status(500).json({ error: "Gagal membuat rekomendasi" });
    return;
  }

  res.status(201).json({
    message: "Rekomendasi berhasil dibuat",
    rekomendasi: {
      rekomendasiId: rekomendasi.rekomendasi_id,
      totalKalori,
      preferensi: preferensiList?.map((p: any) => p.nama_preferensi) ?? [],
      anggaran: anggaran?.jumlah_anggaran ?? null,
    },
  });
};
