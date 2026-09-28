# 🚀 Moonshot 7/24 Bulut Test Laboratuvarı

Bu proje, `moonshot_test_lab.html` içerisindeki **Ekran 1 (Moonshot & Şimşek Balina Avcısı)** test simülasyonunu, bilgisayarınızdan tamamen bağımsız olarak **7/24 kesintisiz** çalıştırıp test verilerini toplamanızı sağlayan bağımsız Node.js motorudur.

---

## 🌟 Özellikler
- **%100 Ücretsiz:** Kredi kartı gerekmeden bulutta çalışır (Render / Koyeb / Vps).
- **Bilgisayardan Bağımsız:** Bilgisayarınızı kapatsanız, uykuya alsanız bile 7/24 Binance verilerini taramaya ve işlem açıp kapatmaya devam eder.
- **Ekran 1 Motoru ile Birebir Aynı Mantık:**
  - 15dk / 1s Radar & Kurumsal Alıcı Baskısı (%50+ Taker Hacim Teyidi)
  - Şimşek Mum İvmesi (+%1.00+ zıplama & 2x Balina Hacmi)
  - Sahte İğne (Wick/Fakeout) Tuzağı Koruması
  - 1.50% Başabaş Kilidi ($0 Risk)
  - 2.50% / 4.50% / 7.50% Kademeli Kâr Kilitleri
  - Moonshot Hedefi (+%15 Spot = +%300 ROI) & Dinamik İzsüren Stop (Trailing)
  - Akıllı Slot Rotasyonu (Uykucu koinleri kapatıp yeni patlayan rokete yer açma)
- **Canlı Web Paneli:** Telefondan ve bilgisayardan her an canlı pozisyonları, bakiyeyi, kazanma oranını ve logları izleme.
- **Tek Tıkla Excel / CSV İndir:** Tüm işlem geçmişini Türkçe karakterli, noktalı virgüllü ve BOM UTF-8 uyumlu olarak Excel'e aktarma.

---

## 🛠️ Yerel Bilgisayarda Test Etme

1. Klasördeki `start.bat` dosyasına çift tıklayın (veya terminalden `node server.js` çalıştırın).
2. Tarayıcınızda açın:
   👉 **http://localhost:3000**
3. Paneli ve canlı logları anlık olarak görebilirsiniz.

---

## ☁️ %100 Ücretsiz 7/24 Buluta Kurulum Rehberi (0 TL / Kredi Kartsız)

En stabil ve popüler ücretsiz yöntem: **GitHub + Render.com + cron-job.org** kombinasyonudur.

### 1. Adım: Kodları GitHub'a Yükleme (2 Dakika)
1. [github.com](https://github.com) sitesine ücretsiz giriş yapın.
2. Sağ üstten **New repository** (Yeni Depo) butonuna tıklayın:
   - Depo adı: `moonshot-cloud-bot`
   - **Private** (Gizli) veya Public seçin.
   - "Create repository" butonuna tıklayın.
3. Bu klasörün içinde PowerShell / Terminal açıp şu 4 komutu yazın:
   ```bash
   git init
   git add .
   git commit -m "Moonshot 7/24 Cloud Bot"
   git branch -M main
   git remote add origin https://github.com/KULLANICI_ADINIZ/moonshot-cloud-bot.git
   git push -u origin main
   ```
   *(Alternatif: GitHub sayfasında "uploading an existing file" linkine basıp bu klasördeki dosyaları sürükleyip bırakabilirsiniz!)*

---

### 2. Adım: Render.com'da Ücretsiz Web Servis Açma (2 Dakika - Kredi Kartı İstemez)
1. [render.com](https://render.com) sitesine gidin ve **GitHub ile Giriş Yap** (Sign in with GitHub) seçin.
2. Dashboard'da **New +** ➔ **Web Service** butonuna tıklayın.
3. Az önce oluşturduğunuz `moonshot-cloud-bot` deposunu seçip **Connect** deyin.
4. Ayarları şu şekilde bırakın:
   - **Name:** `moonshot-cloud-bot` (veya istediğiniz bir isim)
   - **Runtime:** `Node`
   - **Build Command:** (boş bırakabilirsiniz veya `echo ready`)
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free` ($0/month)
5. En alttaki **Create Web Service** butonuna tıklayın!
6. 1-2 dakika içinde size özel bir adres oluşturulacak (Örn: `https://moonshot-cloud-bot.onrender.com`).
   Artık cep telefonunuzdan bile bu adrese girip test motorunu canlı izleyebilirsiniz!

---

### 3. Adım: Motorun 7/24 Hiç Uyumamasını Sağlama (Keep-Alive - 1 Dakika)
Render'ın ücretsiz paketi, siteye 15 dakika kimse girmezse uyku moduna geçer. Motorun **hiç durmadan 7/24 çalışması** için:

1. [cron-job.org](https://cron-job.org) sitesine ücretsiz üye olun.
2. **Create Cronjob** butonuna tıklayın:
   - **Title:** `Moonshot Bot Ping`
   - **URL:** `https://SİZİN-RENDER-ADRESİNİZ.onrender.com/ping`
   - **Execution schedule:** `Every 10 minutes` (Her 10 dakikada bir)
3. **Create** butonuna basarak kaydedin.

🎉 **Tebrikler!** Artık `cron-job.org` her 10 dakikada bir botunuza bir ping atacak. Render hiçbir zaman uyku moduna geçmeyecek; botunuz **365 gün 24 saat bilgisayarınız kapalıyken dahi** Binance'i tarayıp test verilerini toplayacaktır!

---

## 📱 Cep Telefonundan Takip & Excel İndirme

- Cep telefonunuzun tarayıcısından `https://SİZİN-RENDER-ADRESİNİZ.onrender.com` adresini açın.
- Sayfayı ana ekranınıza ekleyerek bir mobil uygulama gibi kullanabilirsiniz.
- İstediğiniz zaman **"📥 Excel / CSV Olarak İndir"** butonuna basarak o ana kadar yapılan tüm test işlemlerini telefonunuza veya bilgisayarınıza anında indirebilirsiniz.
