import React, { useState, useEffect } from "react";
import { PieChart, ClipboardCheck, Star, Sparkles, Menu } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { DashboardView } from "./components/DashboardView";
import { KelolaSiswaView } from "./components/KelolaSiswaView";
import { CetakKartuQRView } from "./components/CetakKartuQRView";
import { KelolaMapelView } from "./components/KelolaMapelView";
import { JadwalMengajarView } from "./components/JadwalMengajarView";
import { InputAbsensiView } from "./components/InputAbsensiView";
import { InputPenilaianView } from "./components/InputPenilaianView";
import { AgendaMengajarView } from "./components/AgendaMengajarView";
import { BimbinganWaliView } from "./components/BimbinganWaliView";
import { DownloadPerangkatAjarView } from "./components/DownloadPerangkatAjarView";
import { GeneratorPerangkatAjarAIView } from "./components/GeneratorPerangkatAjarAIView";
import { ModulAjarAIView } from "./components/ModulAjarAIView";
import { AsistenGuruAIView } from "./components/AsistenGuruAIView";
import { GeneratorLkpdAIView } from "./components/GeneratorLkpdAIView";
import { GeneratorAILainnyaView } from "./components/GeneratorAILainnyaView";
import { PusatLaporanView } from "./components/PusatLaporanView";
import { PengaturanView } from "./components/PengaturanView";
import { ResetDatabaseView } from "./components/ResetDatabaseView";

import { 
  subscribeCollection, 
  subscribePengaturan, 
  batchSaveDocuments, 
  savePengaturan,
  COLLECTIONS 
} from "./lib/firebase";

import { 
  Siswa, 
  Mapel, 
  Jadwal, 
  LogAbsensi, 
  DataNilai, 
  JurnalAgenda, 
  SiswaBimbingan, 
  BimbinganWali, 
  Pengaturan 
} from "./types";

const DEFAULT_CONFIG: Pengaturan = {
  Nama_Guru: "Drs. Yefri Haryanto, M.Pd.",
  NIP_Guru: "19850312 201001 1 008",
  Pemerintah: "PEMERINTAH PROVINSI JAMBI",
  Nama_Sekolah: "SMP NEGERI 3 KERINCI",
  Alamat_Sekolah: "Jalan Raya Lintas Sungai Penuh, Telp: (0748) 21102",
  Nama_Kepsek: "Hamdani, S.Pd., M.Si.",
  NIP_Kepsek: "19780514 200212 1 003",
  Tempat_Tanda_Tangan: "Kerinci",
  Logo_Kiri: "",
  Logo_Kanan: ""
};

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("edadmin_theme") === "dark";
  });
  const [isConnected, setIsConnected] = useState(false);

  // Sync dark class on documentElement and body for Tailwind CSS theme switching
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
      localStorage.setItem("edadmin_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
      localStorage.setItem("edadmin_theme", "light");
    }
  }, [isDarkMode]);

  // Firestore Data Collections
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [mapelList, setMapelList] = useState<Mapel[]>([]);
  const [jadwalList, setJadwalList] = useState<Jadwal[]>([]);
  const [absensiList, setAbsensiList] = useState<LogAbsensi[]>([]);
  const [nilaiList, setNilaiList] = useState<DataNilai[]>([]);
  const [agendaList, setAgendaList] = useState<JurnalAgenda[]>([]);
  const [siswaBimbinganList, setSiswaBimbinganList] = useState<SiswaBimbingan[]>([]);
  const [bimbinganList, setBimbinganList] = useState<BimbinganWali[]>([]);
  const [config, setConfig] = useState<Pengaturan>(DEFAULT_CONFIG);

  // Subscribe to Firebase real-time collections
  useEffect(() => {
    let unsubs: Array<() => void> = [];

    unsubs.push(subscribeCollection<Siswa>(COLLECTIONS.SISWA, (data) => {
      setSiswaList(data);
      setIsConnected(true);
    }));

    unsubs.push(subscribeCollection<Mapel>(COLLECTIONS.MAPEL, (data) => {
      setMapelList(data);
    }));

    unsubs.push(subscribeCollection<Jadwal>(COLLECTIONS.JADWAL, (data) => {
      setJadwalList(data);
    }));

    unsubs.push(subscribeCollection<LogAbsensi>(COLLECTIONS.LOG_ABSENSI, (data) => {
      setAbsensiList(data);
    }));

    unsubs.push(subscribeCollection<DataNilai>(COLLECTIONS.DATA_NILAI, (data) => {
      setNilaiList(data);
    }));

    unsubs.push(subscribeCollection<JurnalAgenda>(COLLECTIONS.JURNAL_AGENDA, (data) => {
      setAgendaList(data);
    }));

    unsubs.push(subscribeCollection<SiswaBimbingan>(COLLECTIONS.SISWA_BIMBINGAN, (data) => {
      setSiswaBimbinganList(data);
    }));

    unsubs.push(subscribeCollection<BimbinganWali>(COLLECTIONS.BIMBINGAN_WALI, (data) => {
      setBimbinganList(data);
    }));

    unsubs.push(subscribePengaturan((cfg) => {
      if (cfg && Object.keys(cfg).length > 0) {
        setConfig((prev) => ({ ...prev, ...cfg }));
      }
    }));

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, []);

  // Seed sample initial data if database is empty on first boot
  useEffect(() => {
    const seedInitialData = async () => {
      // Do not re-seed sample data if database was explicitly cleared/wiped by user
      if (
        localStorage.getItem("edadmin_database_cleared") === "true" ||
        config?.isDatabaseCleared === true
      ) {
        return;
      }

      // Seed Siswa if empty
      if (siswaList.length === 0 && isConnected) {
        const sampleSiswa: Siswa[] = [
          { id: "1001", nisn: "0012345678", nama: "Ahmad Fulan", kelas: "VII A" },
          { id: "1002", nisn: "0012345679", nama: "Siti Aminah", kelas: "VII A" },
          { id: "1003", nisn: "0012345680", nama: "Budi Pratama", kelas: "VII B" },
          { id: "1004", nisn: "0012345681", nama: "Rizky Febrian", kelas: "VII B" }
        ];
        await batchSaveDocuments(COLLECTIONS.SISWA, sampleSiswa);
      }

      // Seed Mapel if empty
      if (mapelList.length === 0 && isConnected) {
        const sampleMapel: Mapel[] = [
          { id: "m1", namaMapel: "Informatika", semester: "Ganjil", tahunAjaran: "2026/2027" },
          { id: "m2", namaMapel: "Matematika", semester: "Ganjil", tahunAjaran: "2026/2027" },
          { id: "m3", namaMapel: "Bahasa Indonesia", semester: "Ganjil", tahunAjaran: "2026/2027" },
          { id: "m4", namaMapel: "IPA Terpadu", semester: "Ganjil", tahunAjaran: "2026/2027" }
        ];
        await batchSaveDocuments(COLLECTIONS.MAPEL, sampleMapel);
      }

      // Seed Jadwal if empty
      if (jadwalList.length === 0 && isConnected) {
        const sampleJadwal: Jadwal[] = [
          { id: "j1", hari: "Senin", jam: "07:30 - 09:00", kelas: "VII A", mapel: "Informatika" },
          { id: "j2", hari: "Selasa", jam: "09:15 - 10:45", kelas: "VII B", mapel: "Informatika" }
        ];
        await batchSaveDocuments(COLLECTIONS.JADWAL, sampleJadwal);
      }

      // Save initial config if empty
      if (!config.Nama_Guru && isConnected) {
        await savePengaturan(DEFAULT_CONFIG);
      }
    };

    seedInitialData();
  }, [isConnected, siswaList.length, mapelList.length, jadwalList.length, config.Nama_Guru, config.isDatabaseCleared]);

  const handleSuccessReset = () => {
    setSiswaList([]);
    setMapelList([]);
    setJadwalList([]);
    setAbsensiList([]);
    setNilaiList([]);
    setAgendaList([]);
    setSiswaBimbinganList([]);
    setBimbinganList([]);
  };

  return (
    <div className={`min-h-screen flex bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors ${isDarkMode ? "dark" : ""}`}>
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
      />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          activeTab={activeTab}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          isDarkMode={isDarkMode}
          onSetDarkMode={(isDark) => setIsDarkMode(isDark)}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          isConnected={isConnected}
          config={config}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-8 custom-scrollbar pb-24 lg:pb-8">
          {activeTab === "dashboard" && (
            <DashboardView
              siswaList={siswaList}
              mapelList={mapelList}
              absensiList={absensiList}
              nilaiList={nilaiList}
              jadwalList={jadwalList}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === "siswa" && <KelolaSiswaView siswaList={siswaList} />}

          {activeTab === "kartu" && <CetakKartuQRView siswaList={siswaList} config={config} />}

          {activeTab === "mapel" && <KelolaMapelView mapelList={mapelList} />}

          {activeTab === "jadwal" && (
            <JadwalMengajarView
              jadwalList={jadwalList}
              mapelList={mapelList}
              siswaList={siswaList}
            />
          )}

          {activeTab === "absensi" && (
            <InputAbsensiView
              siswaList={siswaList}
              mapelList={mapelList}
              absensiList={absensiList}
              config={config}
            />
          )}

          {activeTab === "penilaian" && (
            <InputPenilaianView
              siswaList={siswaList}
              mapelList={mapelList}
              nilaiList={nilaiList}
              config={config}
            />
          )}

          {activeTab === "agenda" && (
            <AgendaMengajarView
              agendaList={agendaList}
              mapelList={mapelList}
              siswaList={siswaList}
              config={config}
            />
          )}

          {activeTab === "bimbingan" && (
            <BimbinganWaliView
              bimbinganList={bimbinganList}
              siswaBimbinganList={siswaBimbinganList}
              siswaList={siswaList}
              config={config}
            />
          )}

          {activeTab === "downloadperangkat" && <DownloadPerangkatAjarView />}

          {activeTab === "perangkat_ai" && <GeneratorPerangkatAjarAIView config={config} />}

          {activeTab === "modulai" && <ModulAjarAIView config={config} />}

          {activeTab === "asistenai" && <AsistenGuruAIView config={config} />}

          {activeTab === "lkpdai" && <GeneratorLkpdAIView config={config} />}

          {activeTab === "ailainnya" && <GeneratorAILainnyaView />}

          {activeTab === "laporan" && (
            <PusatLaporanView
              siswaList={siswaList}
              mapelList={mapelList}
              absensiList={absensiList}
              nilaiList={nilaiList}
              agendaList={agendaList}
              bimbinganList={bimbinganList}
              config={config}
            />
          )}

          {activeTab === "pengaturan" && (
            <PengaturanView
              config={config}
              onNavigateToReset={() => setActiveTab("resetdb")}
            />
          )}

          {activeTab === "resetdb" && (
            <ResetDatabaseView onSuccessReset={handleSuccessReset} />
          )}
        </main>

        {/* Native Mobile Bottom Navigation Bar */}
        <nav 
          className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 z-30 lg:hidden px-2 py-1.5 pb-safe shadow-lg flex items-center justify-around transition-colors"
          aria-label="Navigasi Bawah Mobile"
        >
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all active:scale-90 ${
              activeTab === "dashboard"
                ? "text-blue-600 dark:text-blue-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <PieChart className={`w-5 h-5 ${activeTab === "dashboard" ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-0.5 tracking-tight truncate">Beranda</span>
          </button>

          <button
            onClick={() => setActiveTab("absensi")}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all active:scale-90 ${
              activeTab === "absensi"
                ? "text-blue-600 dark:text-blue-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <ClipboardCheck className={`w-5 h-5 ${activeTab === "absensi" ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-0.5 tracking-tight truncate">Absensi</span>
          </button>

          <button
            onClick={() => setActiveTab("penilaian")}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all active:scale-90 ${
              activeTab === "penilaian"
                ? "text-blue-600 dark:text-blue-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Star className={`w-5 h-5 ${activeTab === "penilaian" ? "scale-110" : ""}`} />
            <span className="text-[10px] mt-0.5 tracking-tight truncate">Nilai</span>
          </button>

          <button
            onClick={() => setActiveTab("perangkat_ai")}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all active:scale-90 ${
              activeTab === "perangkat_ai" || activeTab === "modulai" || activeTab === "asistenai"
                ? "text-amber-500 dark:text-amber-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400"
            }`}
          >
            <Sparkles className={`w-5 h-5 ${activeTab === "perangkat_ai" || activeTab === "modulai" || activeTab === "asistenai" ? "scale-110 text-amber-500" : ""}`} />
            <span className="text-[10px] mt-0.5 tracking-tight truncate">Asisten AI</span>
          </button>

          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all active:scale-90"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 tracking-tight truncate">Menu</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
