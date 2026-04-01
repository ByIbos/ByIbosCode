# ByIbosCode Sistem Mimarisi ve Çalışma Mantığı

Bu döküman, ByIbosCode sisteminin kaputunun altında yatan mimariyi, "Proxy" mantığını ve dil modellerinin (LLM) nasıl "Tool (Fonksiyon) Çağrısı" yaptığını detaylı bir şekilde açıklamak için hazırlanmıştır.

## 1. Genel Mimari (Üçlü Sistem)

Sistem birbiriyle eşzamanlı konuşan 3 ana ayaktan oluşur:

1. **İstemci (ByIbosCode CLI - Yamanmış Claude Code):** Anthropic'in ürettiği, içinde devasa yetenekler barındıran asıl komut satırı aracıdır. Anthropic altyapısına bağlanmak için programlanmıştır ve "Anthropic SSE (Server-Sent Events) API" kurallarıyla konuşur.
2. **Köprü (Local Proxy - `local_proxy.js`):** `8082` portunda dinleme yapan ve İstemci ile Model arasında "Çevirmenlik" görevini üstlenen NodeJS omurgasıdır. 
3. **Motor (LM Studio / OpenAI Local Server):** `1234` portunda çalışan, içerisinde (örneğin Qwen veya Llama) LLM modeli koşturan yerel sunucudur. Burası "OpenAI API" standardına göre istek kabul eder ve gönderir.

**Aksiyon Akışı:**
ByIbosCode CLI (Anthropic Formatı) ➜ `http://localhost:8082` (Proxy Çevirisi) ➜ `http://localhost:1234` (OpenAI Formatı) ➜ LLM Modeli ➜ [Cevap Dönüşü] ➜ Proxy (Yeniden Çeviri) ➜ ByIbosCode CLI

---

## 2. Payload (Veri Paketi) Dönüşüm Sistemleri

Claude Code (Anthropic) ve LM Studio (OpenAI) aynı dili konuşmazlar. Proxy'nin `convertMessages` ve `convertTools` fonksiyonları bu noktada devreye girer.

### Mesaj Çevirileri
* **Anthropic Dili:** `[ { role: 'user', content: [ { type: 'text', text: 'selam' } ] } ]`
* **OpenAI Diline Çeviri:** `[ { role: 'user', content: 'selam' } ]`
* **Tool Result Çevirisi:** Claude bir bash komutu çalıştırdıktan sonra sonucunu `tool_result` dizisi olarak modele iletir. OpenAI formatında böyle bir yapı olmadığı için Proxy bunu `[Tool Result: komut_ciktisi]` şeklinde düz metne / asistan loguna dönüştürerek köprüyü sağlar.

### Sistem Arka Planı (System Prompt)
Uygulama ilk açıldığında CLI, modele yaklaşık 22 bin (22K) token uzunluğunda bir **Sistem Direktifi** fırlatır. İçinde *"Senin adın ByIbos Code... Dosya okuyabilirsin... Şöyle komut yazmalısın..."* gibi kurallar yer alır. Proxy bu devasa metni yakalayıp LM Studio'nun anlayacağı uçtaki `role: 'system'` bloğuna gizlice gömer.

---

## 3. Tool Calling (Fonksiyon / Araç Çağırma) Anatomisi

Sistemin en can alıcı noktası Claude Code'un modele (LLM'e) bilgisayarınızı yönetme yetkisi (Tool Use) vermesidir. 

### A) Tool Tanıtımı (Modelin Zihnini Açmak)
İstemci, her isteğinde Proxy'ye "Benim 26 adet fonksiyonum var (Bash execution, File Edit, vb.)" diyerek bunları gönderir. 
Proxy `convertTools()` fonksiyonunu kullanarak bu Anthropic tipindeki şemayı standart **OpenAI Function Calling** JSON formatına (name, description, parameters) dönüştürüp LM Studio'ya aktarır.

### B) Model'in Tool Kullanmaya Karar Vermesi
LM Studio'daki model işlemi analiz eder. "Kullanıcı benden E:\ZYB klasörünü listelememi istiyor. Benim kendi başıma klasör göremeyeceğimi biliyorum. Ama bana verilen `Bash` fonksiyonunu çağırabilirim" diyerek cevap üretmeye başlar.

Model cevabı düz bir `text` olarak döndürmek yerine bir **JSON fonksiyon çağrısı (Tool Call)** fırlatır:
```json
{
  "name": "Bash",
  "arguments": "{\"command\": \"ls -la E:\\\\ZYB\"}"
}
```

### C) Proxy'nin Tool Kapatma (Yakaldım!) Filtresi
Eğer model `arguments` kısmını boş gönderirse (Örn: `"{}"`), CLI'nin streaming ayrıştırıcı mekanizması (parser) çökebilir. 
Proxy'nin kalbindeki:
`if (Object.keys(input).length === 0) continue;`
kod parçası, model eğer halüsinasyon görüp içi boş yetkisiz bir araç yollarsa saniyesinde bunu yakalayıp iptal eder.

### D) Claude Code'a Geri Dönüş (Fake Streaming Mucizesi)
Anthropic'in İstemcisi gerçek zamanlı (Stream) veri bekler ancak fonksiyon çağrılarında çok katı bir "Chunk (Parça) Kuralları Zinciri" ister:

1. **`content_block_start`**: "Sana bir araç gönderiyorum, argüman kutusunu şimdilik BOŞ `{}` bırak."
2. **`content_block_delta` (`input_json_delta`)**: "Şimdi fonksiyonun içindeki komutu JSON formatında sana veriyorum."
3. **`content_block_stop`**: "Fonksiyon paketini kapattım! Hadi şimdi NodeJS `exec()` kullanarak bunu kendi tarafında çalıştır."

Local Proxy (**Fake-Streaming** mimarisi), LM Studio'dan 10-20 saniye bekleyip fonksiyonu bütün, hatasız ve tek bir blok olarak alır. Ardından bu paketleri anında milisaniyeler içerisinde parçalayıp **Anthropic'in İstediği o 3 Ritmi** art arda fırlatır. İstemci de sanki Anthropic'in milyar dolarlık sunucularından harf harf akmış bir komut geliyormuş gibi bunu kabul eder ve bilgisayarınızda (Örn: terminal komutunu) fiziken çalıştırır!

Bu sayede Proxy tamamen **sıfır-hata oranlı** güvenli ve limitsiz bir geliştirme asistanı altyapısına dönüşür.
