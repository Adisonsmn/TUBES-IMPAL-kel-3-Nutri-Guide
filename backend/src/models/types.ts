export interface User {
  userId: string;
  nama: string;
  email: string;
  passwordHash: string;
  tanggalDaftar: Date;
}

export interface ProfilPribadi {
  userId: string;
  umur: number;
  berat: number;
  tinggi: number;
  gender: string;
  tujuanKesehatan: string;
}

export interface Makanan {
  makananId: string;
  namaMakanan: string;
  kalori: number;
  karbohidrat: number;
  protein: number;
  lemak: number;
  vitamin: string;
  mineral: string;
  hargaPerPorsi: number;
}

export interface Resep {
  resepId: string;
  makananId: string;
  bahan: string;
  langkahMemasak: string;
}

export interface Rekomendasi {
  rekomendasiId: string;
  userId: string;
  tanggal: Date;
  totalKalori: number;
}

export interface RiwayatMakanan {
  riwayatId: string;
  userId: string;
  tanggalKonsumsi: Date;
}

export interface Artikel {
  artikelId: string;
  judul: string;
  konten: string;
  tanggalPublikasi: Date;
}

export interface Motivasi {
  motivasiId: string;
  userId: string;
  konten: string;
  waktuKirim: Date;
}

export interface Pengingat {
  pengingatId: string;
  userId: string;
  jenisPengingat: string;
  waktu: Date;
}

export interface Anggaran {
  anggaranId: string;
  userId: string;
  jumlahAnggaran: number;
  periode: string;
}

export interface Preferensi {
  preferensiId: string;
  userId: string;
  namaPreferensi: string;
}