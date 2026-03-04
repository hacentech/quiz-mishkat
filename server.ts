import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(process.cwd(), "game_data.json");

app.use(cors());
app.use(express.json());

// --- Initial State ---
let gameState = {
  status: {
    currentQuestionId: 1,
    totalQuestions: 0,
    isVotingOpen: false,
    playerAnswers: Array(8).fill(""),
    timerEnd: 0,
    correctAnswer: "",
    gameStarted: false,
    activeSegment: 1,
    scores: Array(8).fill(0),
    grandTotals: Array(8).fill(0),
    selection: {
      blue: Array(8).fill(0),
      green: Array(8).fill(0)
    }
  },
  questions: [],
  gameControl: {
    seg1: Array(8).fill(0),
    seg2: Array(8).fill(0),
    seg3: Array(8).fill(0),
    seg3Count: Array(8).fill(0),
    seg3Bonus: Array(8).fill(0),
    seg4: Array(8).fill(0),
    seg5: Array(8).fill(0),
    live: Array(8).fill(0)
  },
  view: "seg1"
};

// --- Load Data from File ---
if (fs.existsSync(DATA_FILE)) {
  try {
    const savedData = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    gameState = { ...gameState, ...savedData };
    console.log("✅ Game data loaded from local storage");
  } catch (e) {
    console.error("❌ Error loading game data:", e);
  }
}

// --- Save Data to File ---
const saveGameData = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(gameState, null, 2));
  } catch (e) {
    console.error("❌ Error saving game data:", e);
  }
};

// --- API Routes ---

// Get Status
app.get("/api/getStatus", (req, res) => {
  const q = gameState.questions[gameState.status.currentQuestionId - 1] || null;
  res.json({
    success: true,
    serverTime: Date.now(),
    data: {
      status: {
        ...gameState.status,
        totalQuestions: gameState.questions.length
      },
      question: q
    }
  });
});

// Submit Answer
app.get("/api/submitAnswer", (req, res) => {
  const { playerId, answer } = req.query;
  const pIdx = (Number(playerId) || 1) - 1;
  const ans = String(answer || "").trim().toUpperCase();

  if (gameState.status.gameStarted && gameState.status.isVotingOpen) {
    if (gameState.status.playerAnswers[pIdx] === "") {
      gameState.status.playerAnswers[pIdx] = ans;
      saveGameData();
    }
  }
  res.json({ success: true });
});

// Toggle Voting
app.get("/api/toggleVoting", (req, res) => {
  gameState.status.isVotingOpen = !gameState.status.isVotingOpen;
  saveGameData();
  res.json({ success: true });
});

// Set Game Status
app.get("/api/setGameStatus", (req, res) => {
  const started = req.query.started === "true";
  gameState.status.gameStarted = started;
  if (!started) gameState.status.isVotingOpen = false;
  saveGameData();
  res.json({ success: true });
});

// Next/Prev Question
app.get("/api/nextQuestion", (req, res) => {
  gameState.status.currentQuestionId = Math.min(gameState.status.currentQuestionId + 1, gameState.questions.length || 1);
  resetQuestionState();
  saveGameData();
  res.json({ success: true });
});

app.get("/api/prevQuestion", (req, res) => {
  gameState.status.currentQuestionId = Math.max(1, gameState.status.currentQuestionId - 1);
  resetQuestionState();
  saveGameData();
  res.json({ success: true });
});

const resetQuestionState = () => {
  gameState.status.isVotingOpen = true; // Auto-open as requested
  gameState.status.playerAnswers = Array(8).fill("");
  const q = gameState.questions[gameState.status.currentQuestionId - 1];
  gameState.status.correctAnswer = q ? q.correct : "";
};

// Update Scores (Quiz Logic)
app.get("/api/updateScores", (req, res) => {
  const q = gameState.questions[gameState.status.currentQuestionId - 1];
  if (q && q.correct) {
    gameState.status.playerAnswers.forEach((ans, i) => {
      if (ans === q.correct) {
        gameState.status.scores[i] += 10;
        gameState.gameControl.seg1[i] = gameState.status.scores[i];
      }
    });
    updateGrandTotals();
    saveGameData();
  }
  res.json({ success: true, message: "Scores updated locally" });
});

// Segment Controls
app.get("/api/setActiveSegment", (req, res) => {
  gameState.status.activeSegment = Number(req.query.segment as string) || 1;
  saveGameData();
  res.json({ success: true });
});

// Atomic Game Control Actions
app.get("/api/addSeg2", (req, res) => {
  const pIdx = (Number(req.query.playerId) || 1) - 1;
  gameState.gameControl.seg2[pIdx] += 20;
  updateLiveRow("seg2");
  updateGrandTotals();
  saveGameData();
  res.json({ success: true });
});

app.get("/api/addSeg3", (req, res) => {
  const pIdx = (Number(req.query.playerId) || 1) - 1;
  gameState.gameControl.seg3[pIdx] += 10;
  gameState.gameControl.seg3Count[pIdx] += 1;
  if (gameState.gameControl.seg3Count[pIdx] === 7) gameState.gameControl.seg3Bonus[pIdx] = 5;
  updateLiveRow("seg3");
  updateGrandTotals();
  saveGameData();
  res.json({ success: true });
});

app.get("/api/addSeg4", (req, res) => {
  const pIdx = (Number(req.query.playerId) || 1) - 1;
  gameState.gameControl.seg4[pIdx] += 25;
  updateLiveRow("seg4");
  updateGrandTotals();
  saveGameData();
  res.json({ success: true });
});

app.get("/api/addSeg5", (req, res) => {
  const pIdx = (Number(req.query.playerId) || 1) - 1;
  const pts = Number(req.query.points) || 0;
  gameState.gameControl.seg5[pIdx] += pts;
  updateLiveRow("seg5");
  updateGrandTotals();
  saveGameData();
  res.json({ success: true });
});

app.get("/api/toggleSelect", (req, res) => {
  const pIdx = (Number(req.query.playerId) || 1) - 1;
  gameState.status.selection.blue[pIdx] = gameState.status.selection.blue[pIdx] === 1 ? 0 : 1;
  saveGameData();
  res.json({ success: true });
});

app.get("/api/commitSelection", (req, res) => {
  gameState.status.selection.green = [...gameState.status.selection.blue];
  saveGameData();
  res.json({ success: true });
});

app.get("/api/setView", (req, res) => {
  gameState.view = (req.query.view as string) || "seg1";
  updateLiveRow(gameState.view);
  saveGameData();
  res.json({ success: true });
});

app.get("/api/resetSegment", (req, res) => {
  const seg = req.query.segment as string;
  for (let i = 0; i < 8; i++) {
    if (seg === "2") gameState.gameControl.seg2[i] = 0;
    if (seg === "3") { gameState.gameControl.seg3[i] = 0; gameState.gameControl.seg3Count[i] = 0; gameState.gameControl.seg3Bonus[i] = 0; }
    if (seg === "4") gameState.gameControl.seg4[i] = 0;
    if (seg === "5") gameState.gameControl.seg5[i] = 0;
  }
  updateGrandTotals();
  saveGameData();
  res.json({ success: true });
});

// --- Helper Functions ---
const updateGrandTotals = () => {
  for (let i = 0; i < 8; i++) {
    gameState.status.grandTotals[i] = 
      gameState.gameControl.seg1[i] + 
      gameState.gameControl.seg2[i] + 
      gameState.gameControl.seg3[i] + 
      gameState.gameControl.seg3Bonus[i] + 
      gameState.gameControl.seg4[i] + 
      gameState.gameControl.seg5[i];
  }
};

const updateLiveRow = (viewMode: string) => {
  for (let i = 0; i < 8; i++) {
    let val = 0;
    if (viewMode === "seg1") val = gameState.gameControl.seg1[i];
    else if (viewMode === "seg2") val = gameState.gameControl.seg2[i];
    else if (viewMode === "seg3") val = gameState.gameControl.seg3[i] + gameState.gameControl.seg3Bonus[i];
    else if (viewMode === "seg4") val = gameState.gameControl.seg4[i];
    else if (viewMode === "seg5") val = gameState.gameControl.seg5[i];
    else if (viewMode === "total") val = gameState.status.grandTotals[i];
    gameState.gameControl.live[i] = val;
  }
};

// --- Questions Management (For local use) ---
// You can add questions to game_data.json or via a hidden admin route
app.post("/api/uploadQuestions", (req, res) => {
  gameState.questions = req.body.questions || [];
  saveGameData();
  res.json({ success: true, count: gameState.questions.length });
});

// --- Start Server ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 MISHKAH Local Server running at http://localhost:${PORT}`);
  });
}

startServer();
