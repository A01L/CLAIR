(function (w, d) {
  if (w.ClairWidget) return;

  const ClairWidget = {
    init(options = {}) {
      this.apiBase = options.apiBase || "http://26.185.77.179:3000/api";
      this.channelId = Number(options.channelId || 0);
      this.channelKey = options.channelKey || "";
      this.mode = options.mode || "floating";
      this.placeholder = options.placeholder || "Опишите проблему";
      this.title = options.title || "Clair Assistant";

      if (!this.apiBase || !this.channelId || !this.channelKey) {
        console.error("ClairWidget init error: apiBase, channelId, channelKey required");
        return;
      }

      this.render();
      console.log("✅ ClairWidget ready");
    },

    render() {
      const box = d.createElement("div");
      box.id = "clair-widget-box";
      box.style.cssText = `
        position: fixed;
        right: 20px;
        bottom: 20px;
        width: 360px;
        background: white;
        border-radius: 18px;
        box-shadow: 0 10px 30px rgba(0,0,0,.12);
        z-index: 999999;
        font-family: Arial, sans-serif;
        overflow: hidden;
      `;

      box.innerHTML = `
        <div style="background:#111827;color:#fff;padding:14px 16px;font-weight:700;">${this.title}</div>
        <div style="padding:14px;display:flex;flex-direction:column;gap:10px;">
          <textarea id="clair-widget-text" placeholder="${this.placeholder}" style="width:100%;min-height:120px;padding:12px;border:1px solid #d1d5db;border-radius:12px;resize:vertical;"></textarea>
          <button id="clair-widget-send" style="background:#111827;color:white;border:none;border-radius:12px;padding:12px;cursor:pointer;font-weight:700;">Отправить</button>
          <div id="clair-widget-status" style="font-size:13px;color:#6b7280;">Готово</div>
        </div>
      `;

      d.body.appendChild(box);

      d.getElementById("clair-widget-send").addEventListener("click", async () => {
        const text = d.getElementById("clair-widget-text").value.trim();
        const status = d.getElementById("clair-widget-status");

        if (!text) {
          status.textContent = "Введите текст обращения";
          return;
        }

        try {
          status.textContent = "Отправка...";

          const r = await fetch(`${this.apiBase}/appeals/external`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-channel-key": this.channelKey
            },
            body: JSON.stringify({
              cid: this.channelId,
              text
            })
          });

          const data = await r.json();

          if (!r.ok) {
            throw new Error(data?.error || "Send failed");
          }

          status.textContent = "Обращение отправлено";
          d.getElementById("clair-widget-text").value = "";
        } catch (e) {
          status.textContent = e.message || "Ошибка отправки";
        }
      });
    }
  };

  w.ClairWidget = ClairWidget;
})(window, document);