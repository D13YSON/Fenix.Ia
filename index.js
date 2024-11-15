// Importando o módulo express
const express = require('express');
const path = require('path');

// Criando o aplicativo Express
const app = express();

// Definindo a porta
const port = 3000;

// Servindo os arquivos estáticos (como o HTML)
app.use(express.static(path.join(__dirname)));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciando o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
