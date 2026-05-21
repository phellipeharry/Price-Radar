#  Radar de Preços - Chrome Extension (Manifest V3)

<p align="center">
  <img src="logo.png" width="128" height="128" alt="Radar de Preços Logo" />
</p>

O **Radar de Preços** é uma extensão de navegador moderna e de alto desempenho para o Google Chrome, desenvolvida na arquitetura **Manifest V3**. Ela foi projetada para ajudar você a economizar dinheiro monitorando e comparando os preços dos seus produtos favoritos em múltiplos sites de e-commerce ao mesmo tempo, emitindo notificações nativas no sistema operacional (Windows/macOS) assim que um preço cai.

---

##  Principais Funcionalidades

- ** Seleção de Preços Interativa**: Navegue em qualquer loja e clique diretamente no valor do preço usando o realce visual (overlay azul) para começar a monitorar.
- ** Comparação Multi-site**: Agrupe vários links de lojas diferentes sob um mesmo grupo de produto (ex: "PlayStation 5") para manter o seu painel limpo e organizado.
- ** Destaque da Melhor Oferta**: O dashboard exibe instantaneamente qual site oferece o menor preço no momento com um selo dinâmico.
- ** Design Premium em Glassmorphism**: Interface do usuário moderna com efeito de vidro acrílico, tema escuro e micro-animações para quedas de preços.
- ** Histórico de Preços**: Clique em qualquer produto para expandir o painel e ver a tabela com o histórico detalhado de alterações, datas de checagem e links diretos.
- ** Notificações Nativas**: Receba alertas nativos na área de trabalho quando uma loja reduzir o preço do produto. Clique no alerta para ir diretamente à loja.
- ** Frequência Customizável**: Ajuste a periodicidade do scanner em segundo plano (ex: a cada 15m, 1h, 4h, etc.).

---

##  Arquitetura Técnica (Manifest V3)

A extensão é estruturada utilizando as melhores práticas modernas recomendadas pela equipe do Google Chrome:
- **`manifest.json`**: Configurações de segurança e permissões declaradas rigorosamente sob demanda (`storage`, `alarms`, `notifications`, `offscreen`, `scripting`).
- **`background.js`**: Service Worker central que roda de forma assíncrona, agendado pelo `chrome.alarms` para não consumir bateria ou memória do computador.
- **`offscreen.html` & `offscreen.js`**: Solução nativa do Manifest V3 para realizar requisições web e parsear o HTML via DOM Parser (`DOMParser`) sem bloquear a thread principal de navegação.
- **`content.js`**: Script dinâmico e isolado injetado em tempo de execução para seleção interativa do elemento na página.

---

##  Como Instalar no Google Chrome

Siga as instruções abaixo para testar a extensão localmente no seu computador:

1. Faça o download ou clone este repositório.
2. Abra o **Google Chrome** e acesse a página de extensões digitando `chrome://extensions/` na barra de endereços.
3. No canto superior direito da página, ative o botão **Modo do desenvolvedor** (Developer Mode).
4. No canto superior esquerdo, clique no botão **Carregar sem pacote** (Load unpacked).
5. Selecione a pasta raiz da extensão (onde o arquivo `manifest.json` está localizado).
6. Fixe a extensão na barra de ferramentas do Chrome para começar a usar!

---

##  Como Testar as Notificações de Queda de Preço

Como a checagem é feita de forma assíncrona em segundo plano, você pode simular uma queda de preço imediata para testar as notificações nativas:

1. Acesse um e-commerce e adicione um produto ao monitoramento (ex: um livro de R$ 100,00).
2. Clique com o botão direito no ícone da extensão no Chrome e selecione **Inspecionar pop-up** (Inspect popup).
3. No **Console** da janela que abrir, cole o seguinte comando para simular que o preço anterior monitorado era alto (R$ 9.999,00):
   ```javascript
   chrome.storage.local.get('products', (data) => {
     if (data.products && data.products.length > 0) {
       data.products[0].sources.forEach(src => {
         src.originalPrice = 9999.00;
         src.currentPrice = 9999.00;
       });
       chrome.storage.local.set({ products: data.products }, () => {
         console.log("Simulação de preço alto salva! Agora force a atualização no popup.");
       });
     }
   });
   ```
4. Feche o console, abra o popup da extensão e clique no botão **Atualizar todos os preços** (ícone circular ao lado do título).
5. O sistema fará o scraping real, identificará que o preço despencou de R$ 9.999,00 para o valor real da página e disparará o alerta nativo no seu Windows/macOS.
