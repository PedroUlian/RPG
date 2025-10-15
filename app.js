// server.js
import express from "express";
import { Server } from "socket.io";
import http from "http";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import fetch from "node-fetch";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "static"))); // pasta static igual testMain

// PostgreSQL com SSL
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Inicializar DB
async function initDB() {
  const client = await pool.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      text TEXT NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  client.release();
}
initDB().catch(console.error);

// Página inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "static", "index.html"));
});

// Histórico de mensagens
app.get("/history", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.id, u.username, m.text
      FROM messages m
      JOIN users u ON m.user_id = u.id
      ORDER BY m.id ASC
      LIMIT 100
    `);
    const msgs = result.rows.map(r => ({ user: r.username, text: r.text }));
    res.json(msgs);
  } catch (err) {
    console.error("Erro ao buscar histórico:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Limpar histórico
app.post("/clear_history", async (req, res) => {
  try {
    await pool.query("DELETE FROM messages");
    io.emit("history_cleared");
    res.json({ status: "ok" });
  } catch (err) {
    console.error("Erro ao limpar histórico:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Registro de usuário
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO users (username, password, isadmin) VALUES ($1, $2, false) RETURNING id",
      [username, password]
    );
    res.json({ status: "ok", user_id: result.rows[0].id, isadmin: false });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// Login de usuário
app.post("/login", async (req, res) => {
  const { username, password, isadmin } = req.body;
  try {
    const result = await pool.query(
      "SELECT id, isadmin FROM users WHERE username=$1 AND password=$2",
      [username, password]
    );

    if (result.rows.length === 0) 
      return res.status(401).json({ error: "Usuário ou senha inválidos" });

    const user = result.rows[0];

    // retorna id e admin
    res.json({ 
      status: "ok", 
      user_id: user.id, 
      isadmin: !!user.isadmin // boolean
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post("/save_sheet", async (req, res) => {
  const { username, nome, classe, raca, descricao } = req.body;
  try {
    const userResult = await pool.query("SELECT id FROM users WHERE username=$1", [username]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: "Usuário não encontrado" });
    const user_id = userResult.rows[0].id;

    await pool.query(`
      INSERT INTO character_sheet (user_id, nome, classe, raca, descricao)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE SET
        nome = $2,
        classe = $3,
        raca = $4,
        descricao = $5
    `, [user_id, nome, classe, raca, descricao]);

    res.json({ status: "ok" });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// Pegar ficha
app.get("/get_sheet/:username", async (req,res) => {
  const username = req.params.username;
  try {
    const userResult = await pool.query("SELECT id FROM users WHERE username=$1", [username]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: "Usuário não encontrado" });
    const user_id = userResult.rows[0].id;

    const sheetResult = await pool.query("SELECT * FROM character_sheet WHERE user_id=$1", [user_id]);
    if (sheetResult.rows.length === 0) return res.json({}); // ficha vazia

    res.json(sheetResult.rows[0]);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Rota para o admin ver todas as fichas
app.get("/get_all_sheets", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.username, c.nome, c.classe, c.raca, c.nivel, c.forca, c.velocidade, 
             c.inteligencia, c.mana, c.descricao
      FROM character_sheet c
      JOIN users u ON u.id = c.user_id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao buscar fichas:", err.message);
    res.status(500).json({ error: "Erro ao buscar fichas" });
  }
});

// Pegar história
app.get("/get_historia", async (req, res) => {
  try {
    const result = await pool.query("SELECT conteudo FROM historia LIMIT 1");
    if (result.rows.length === 0)
      return res.json({ conteudo: "" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao buscar história:", err.message);
    res.status(500).json({ error: "Erro ao buscar história" });
  }
});

// Salvar/editar história (apenas admin)
app.post("/save_historia", async (req, res) => {
  const { conteudo } = req.body;
  try {
    await pool.query(`
      UPDATE historia SET conteudo=$1 WHERE id=1;
    `, [conteudo]);
    res.json({ status: "ok" });
  } catch (err) {
    console.error("Erro ao salvar história:", err.message);
    res.status(500).json({ error: "Erro ao salvar história" });
  }
});

async function query(data) {
	const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
		headers: {
			Authorization: `Bearer ${process.env.HF_API_KEY}`,
			"Content-Type": "application/json",
		},
		method: "POST",
		body: JSON.stringify(data),
	});

	const result = await response.json();
	return result;
}

app.post("/chat", async (req, res) => {
	try {
		const { message } = req.body;

		if (!message) {
			return res.status(400).json({ error: "Mensagem não fornecida" });
		}

		const resposta = await query({
			messages: [
				{ role: "user", content: "Você só responde em português brasileiro e de forma direta" },
			],
			model: "microsoft/DialoGPT-medium",
		});

		if (resposta.error) {
			console.error("Erro do modelo:", resposta.error);
			return res.status(500).json({ error: resposta.error });
		}

		const conteudo = resposta.choices?.[0]?.message?.content || "Sem resposta do modelo.";
		res.json({ reply: conteudo });

	} catch (err) {
		console.error("Erro no /chat:", err);
		res.status(500).json({ error: "Erro interno no servidor" });
	}
});


// SocketIO
io.on("connection", (socket) => {
  console.log("Cliente conectado");

  socket.on("message", async (data) => {
    const { user, text } = data;
    if (!user || !text) return;

    try {
      const userResult = await pool.query(
        "SELECT id FROM users WHERE username=$1",
        [user]
      );
      if (userResult.rows.length === 0) return;

      const user_id = userResult.rows[0].id;

      await pool.query(
        "INSERT INTO messages (user_id, text) VALUES ($1, $2)",
        [user_id, text]
      );

      io.emit("message", data);
    } catch (err) {
      console.error("Erro ao salvar mensagem:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado");
  });
});

// Rodar servidor
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
