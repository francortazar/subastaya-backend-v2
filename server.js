function getSupabaseWithAuth(token) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  );
}
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const fileUpload = require("express-fileupload");
app.use(fileUpload());

// Conexión a Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
async function verificarAdminMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data, error } = await supabaseAuth.auth.getUser();

    if (error || !data.user) {
      return res.status(401).json({ error: "Usuario inválido" });
    }

    const { data: perfil } = await supabaseAuth
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .single();

    if (!perfil?.is_admin) {
      return res.status(403).json({ error: "No sos admin" });
    }

    req.user = data.user;
    next();

  } catch (err) {
    res.status(500).json({ error: "Error validando admin" });
  }
}
async function verificarAdmin(token) {

  const supabaseAuth = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  );

  const { data, error } = await supabaseAuth.auth.getUser();

  if (error || !data.user) return null;

  const { data: perfil } = await supabaseAuth
    .from("profiles")
    .select("is_admin")
    .eq("id", data.user.id)
    .single();

  if (!perfil?.is_admin) return null;

  return data.user;
}

// Ruta de prueba
app.get("/", (req, res) => res.send("Servidor funcionando 🚀"));

// =========================
// REGISTRO
// =========================
app.post("/register", async (req, res) => {
  try {
    const { email, password, username, telefono, provincia, preferencias } = req.body;
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });

    const user = data.user;
    const { error: errorProfile } = await supabase
      .from("profiles")
      .insert([{ id: user.id, email, username, telefono, provincia, preferencias }]);

    if (errorProfile) return res.status(400).json({ error: errorProfile.message });
    res.json({ msg: "Usuario creado correctamente" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// LOGIN
// =========================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json({ error: error.message });

    res.json({ msg: "Login correcto", session: data.session, user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// OBTENER USUARIO LOGUEADO
// =========================
// =========================
// OBTENER USUARIO LOGUEADO (FIX)
// =========================
app.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data, error } = await supabaseAuth.auth.getUser();

    if (error || !data.user) {
      return res.status(401).json({ error: "Usuario inválido" });
    }

    // traer perfil
const { data: perfil } = await supabaseAuth
  .from("profiles")
  .select("username, telefono, is_admin")
  .eq("id", data.user.id)
  .single();

const safeProfile = {
  username: perfil?.username || "Usuario",
  telefono: perfil?.telefono || "-",
  is_admin: perfil?.is_admin || false
};

res.json({
  user: data.user,
  profile: safeProfile
});

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// CREAR SUBASTA
// =========================
app.post("/crear-subasta", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return res.status(401).json({ error: "Usuario inválido" });

    const user = userData.user;
    const { titulo, descripcion, rubro, precio_inicial, incremento_puja, fecha_fin, provincia, imagenes } = req.body;

    let duracion_ms;
    switch (fecha_fin) {
      case "5m": duracion_ms = 5 * 60 * 1000; break;
      case "1d": duracion_ms = 24 * 60 * 60 * 1000; break;
      case "1w": duracion_ms = 7 * 24 * 60 * 60 * 1000; break;
      case "1M": duracion_ms = 30 * 24 * 60 * 60 * 1000; break;
      default: duracion_ms = 0;
    }

    const ahora = new Date();
const fechaFinReal = new Date(ahora.getTime() + duracion_ms);
    const imagenesValidas = (imagenes || []).filter(img => img);

    const { data: auctionData, error: auctionError } = await supabase
      .from("auctions")
      .insert([{
        user_id: user.id,
        titulo,
        descripcion,
        rubro,
        precio_inicial,
        incremento_puja,
        fecha_fin: fechaFinReal.toISOString(),
        duracion: duracion_ms,
        provincia,
        imagenes: imagenesValidas
      }]);

    if (auctionError) return res.status(500).json({ error: auctionError.message });
    res.json({ msg: "Subasta creada correctamente", data: auctionData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// EDITAR SUBASTA
// =========================
app.put("/editar-subasta/:id", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData.user;

    const { id } = req.params;

    const {
      titulo,
      descripcion,
      rubro,
      precio_inicial,
      incremento_puja,
      fecha_fin,
      provincia,
      imagenes
    } = req.body;

    // 🔥 CALCULAR NUEVA DURACIÓN (IGUAL QUE CREAR)
    let duracion_ms;
    switch (fecha_fin) {
      case "5m": duracion_ms = 5 * 60 * 1000; break;
      case "1d": duracion_ms = 24 * 60 * 60 * 1000; break;
      case "1w": duracion_ms = 7 * 24 * 60 * 60 * 1000; break;
      case "1M": duracion_ms = 30 * 24 * 60 * 60 * 1000; break;
      default: duracion_ms = 0;
    }

    const ahora = new Date();
const fechaFinReal = new Date(ahora.getTime() + duracion_ms);

    // 🔥 ACTUALIZAR Y REINICIAR
    const { error } = await supabase
      .from("auctions")
      .update({
        titulo,
        descripcion,
        rubro,
        precio_inicial,
        incremento_puja,
        provincia,
        imagenes,
        duracion: duracion_ms,
        fecha_fin: fechaFinReal.toISOString(),
        fecha_creacion: new Date() // 🔥 ESTA ES LA CLAVE
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ msg: "Subasta re-publicada correctamente" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =========================
// OBTENER SUBASTAS
// =========================
app.get("/subastas", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    let user_id = null;

    if (token) {
      const supabaseAuth = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      );

      const { data } = await supabaseAuth.auth.getUser();
      user_id = data?.user?.id || null;
    }

    // 1. traer subastas
    const { data: subastas, error } = await supabase
      .from("auctions")
      .select("*")
      .order("fecha_creacion", { ascending: false });

    if (error) return res.json({ error });

    let ocultasIds = [];

    // 2. traer ocultos del usuario
    if (user_id) {
      const { data: ocultos } = await supabase
        .from("ocultos")
        .select("ref_id")
        .eq("user_id", user_id)
        .eq("tipo", "subasta");

      ocultasIds = (ocultos || []).map(o => o.ref_id);
    }

    // 3. filtrar
    const visibles = subastas.filter(
      s => !ocultasIds.includes(String(s.id))
    );

    res.json(visibles);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// OBTENER UNA SUBASTA (PARA EDITAR)
// =========================
app.get("/subasta/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("auctions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Subasta no encontrada" });
    }

    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 

// =========================
// SUBIR IMAGEN
// =========================
app.post("/subir-imagen", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { imagenBase64, nombreArchivo } = req.body;
    if (!imagenBase64) return res.status(400).json({ error: "No se recibió imagen" });

    const base64Data = imagenBase64.split(",")[1];

    const { data, error } = await supabaseAuth.storage
      .from("subastas")
      .upload(nombreArchivo, Buffer.from(base64Data, "base64"), { contentType: "image/jpeg", upsert: true });

    if (error) return res.status(500).json({ error: error.message });

    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/subastas/${nombreArchivo}`;
    res.json({ url: publicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// CREAR PREGUNTA
// =========================
app.post("/questions", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    // validar usuario
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return res.status(401).json({ error: "Usuario inválido" });
    }

    const { auction_id, question } = req.body;

    if (!auction_id || !question) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    // insertar pregunta
    const { data, error } = await supabase
      .from("questions")
      .insert([{
        auction_id,
        user_id: userData.user.id,
        question
      }])
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      msg: "Pregunta enviada",
      data: data?.[0] || null
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// OBTENER PREGUNTAS
// =========================
app.get("/questions", async (req, res) => {
  try {
    const { auction_id } = req.query;

    if (!auction_id) {
      return res.status(400).json({ error: "Falta auction_id" });
    }

    // 1. traer preguntas
    const { data: questions, error } = await supabase
      .from("questions")
      .select("*")
      .eq("auction_id", auction_id)
      .order("created_at", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    // 2. traer perfiles (para username)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username");

    // 3. unir manualmente
    const questionsWithUser = questions.map(q => {
      const user = profiles.find(p => p.id === q.user_id);

      return {
  ...q,
  user: user || null,
  auction_user_id: profiles.find(p => p.id === q.user_id)?.id // temporal (lo mejoramos después)
};
    });

    res.json(questionsWithUser);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// RESPONDER PREGUNTA
// =========================
app.post("/questions/answer", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return res.status(401).json({ error: "Usuario inválido" });
    }

    const { question_id, answer } = req.body;

    if (!question_id || !answer) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    // 🔥 traer pregunta
    const { data: questionData, error: qError } = await supabase
      .from("questions")
      .select("*")
      .eq("id", question_id)
      .single();

    if (qError || !questionData) {
      return res.status(404).json({ error: "Pregunta no encontrada" });
    }

    // 🔥 traer subasta
    const { data: auctionData } = await supabase
      .from("auctions")
      .select("user_id")
      .eq("id", questionData.auction_id)
      .single();

    // ❌ solo vendedor puede responder
    if (auctionData.user_id !== userData.user.id) {
      return res.status(403).json({ error: "No autorizado para responder" });
    }

    // ✅ guardar respuesta
    const { error } = await supabase
      .from("questions")
      .update({
        answer,
        answered_at: new Date().toISOString()
      })
      .eq("id", question_id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ msg: "Respuesta enviada" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ELIMINAR PREGUNTA
// =========================
app.delete("/questions/:id", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return res.status(401).json({ error: "Usuario inválido" });
    }

    const questionId = req.params.id;

    // 🔥 traer pregunta
    const { data: questionData, error: qError } = await supabase
      .from("questions")
      .select("*")
      .eq("id", questionId)
      .single();

    if (qError || !questionData) {
      return res.status(404).json({ error: "Pregunta no encontrada" });
    }

    // 🔥 traer subasta
    const { data: auctionData } = await supabase
      .from("auctions")
      .select("user_id")
      .eq("id", questionData.auction_id)
      .single();

    // ❌ solo vendedor puede eliminar
    if (auctionData.user_id !== userData.user.id) {
      return res.status(403).json({ error: "No autorizado para eliminar" });
    }

    // ✅ eliminar
    const { error } = await supabase
      .from("questions")
      .delete()
      .eq("id", questionId);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ msg: "Pregunta eliminada" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// PUJAR
// =========================
app.post("/pujar", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  }
);

const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData.user) return res.status(401).json({ error: "Usuario inválido" });

    const { auction_id, monto } = req.body;
    if (!auction_id || !monto) return res.status(400).json({ error: "Faltan datos" });

    const { data: auctionData, error: auctionError } = await supabase
      .from("auctions")
      .select("*")
      .eq("id", auction_id)
      .single();

    if (auctionError || !auctionData) return res.status(404).json({ error: "Subasta no encontrada" });

    // Evitar que el propietario puje sobre su propia subasta
    if (auctionData.user_id === userData.user.id) return res.status(403).json({ error: "No puedes pujar en tu propia subasta" });

    // Última puja
const { data: lastBidData } = await supabase
  .from("bids")
  .select("*")
  .eq("auction_id", auction_id)
  .order("monto", { ascending: false })
  .limit(1);

const ultimaPujaObj = lastBidData.length > 0 ? lastBidData[0] : null;
const ultimaPuja = ultimaPujaObj ? parseFloat(ultimaPujaObj.monto) : parseFloat(auctionData.precio_inicial);

// ❗ NUEVO: evitar doble puja consecutiva
if (ultimaPujaObj && ultimaPujaObj.user_id === userData.user.id) {
  return res.status(400).json({ error: "No puedes pujar dos veces seguidas" });
}
    // Monto mínimo con porcentaje definido por el vendedor
    const porcentaje = parseFloat(auctionData.incremento_puja || 10);
    const minimo = ultimaPuja * (1 + porcentaje / 100);

    if (parseFloat(monto) < minimo) {
      return res.status(400).json({ error: `Monto mínimo permitido: ${Math.ceil(minimo)}` });
    }

    const { data: bidData, error: bidError } = await supabase
  .from("bids")
  .insert([{
  auction_id,
  user_id: userData.user.id,
  monto,
  created_at: new Date().toISOString() // 🔥 CLAVE
}])
  .select(); // 👈 ESTO ES CLAVE

if (bidError) return res.status(500).json({ error: bidError.message });

res.json({ 
  msg: "Puja realizada correctamente", 
  data: bidData?.[0] || null 
});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// OBTENER PUJAS DE UNA SUBASTA
// =========================
app.get("/bids", async (req, res) => {
  try {
    const { auction_id } = req.query;
    if (!auction_id) return res.status(400).json({ error: "Falta auction_id" });

    // 1. Traer bids
    const { data: bids, error } = await supabase
      .from("bids")
      .select("*")
      .eq("auction_id", auction_id)
      .order("monto", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // 2. Traer perfiles
    const userIds = [...new Set(bids.map(b => b.user_id))];

const { data: perfiles } = await supabase
  .from("profiles")
  .select("id, username, telefono")
  .in("id", userIds);

    // 3. Unir
    const bidsConUsuario = bids.map(bid => {
  const user = perfiles.find(p => p.id === bid.user_id);

  return {
    ...bid,
    user: {
      username: user?.username || "Usuario",
      telefono: user?.telefono || "-"
    }
  };
});

    res.json(bidsConUsuario);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// MIS SUBASTAS GANADAS
// =========================


// =========================
// ADMIN STATS
// =========================
app.get("/admin/stats", verificarAdminMiddleware, async (req, res) => {
  try {
    const { provincia, categoria } = req.query;

    // =========================
    // USUARIOS
    // =========================
    let queryUsuarios = supabase
      .from("profiles")
      .select("*");

    if (provincia) {
      queryUsuarios = queryUsuarios.eq("provincia", provincia);
    }

    if (categoria) {
      queryUsuarios = queryUsuarios.contains("preferencias", [categoria]);
    }

    const { data: usuarios, error: errorUsuarios } = await queryUsuarios;
    if (errorUsuarios) throw errorUsuarios;

    // =========================
    // SUBASTAS
    // =========================
    let querySubastas = supabase
      .from("auctions") // 🔥 BIEN: vos usás "auctions"
      .select("*");

    if (provincia) {
      querySubastas = querySubastas.eq("provincia", provincia);
    }

    if (categoria) {
      querySubastas = querySubastas.eq("rubro", categoria);
    }

    const { data: subastas, error: errorSubastas } = await querySubastas;
    if (errorSubastas) throw errorSubastas;

    res.json({
  usuarios: usuarios.length,
  subastas: subastas.length,
  listaUsuarios: usuarios,
  listaSubastas: subastas
});

  } catch (err) {
    console.error("Error admin stats:", err);
    res.status(500).json({ error: "Error obteniendo estadísticas" });
  }
});

app.post("/favorites/toggle", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData.user) {
      return res.status(401).json({ error: "Usuario inválido" });
    }

    const user_id = userData.user.id;
    const { auction_id } = req.body;

    if (!auction_id) {
      return res.status(400).json({ error: "Falta auction_id" });
    }

    // 1. verificar si existe
    const { data: existing } = await supabase
      .from("favorites")
      .select("*")
      .eq("user_id", user_id)
      .eq("auction_id", auction_id)
      .maybeSingle();

    // 2. si existe → borrar
    if (existing) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("id", existing.id);

      if (error) return res.status(500).json({ error: error.message });

      return res.json({ status: "removed" });
    }

    // 3. si no existe → crear
    const { error } = await supabase
      .from("favorites")
      .insert([
        {
          user_id,
          auction_id
        }
      ]);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ status: "added" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/favorites/check", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.json({ favorito: false });

    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data: userData } = await supabaseAuth.auth.getUser();
    if (!userData?.user) return res.json({ favorito: false });

    const user_id = userData.user.id;
    const { auction_id } = req.query;

    const { data } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user_id)
      .eq("auction_id", auction_id)
      .maybeSingle();

    res.json({ favorito: !!data });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// OBTENER FAVORITOS
// =========================
app.get("/favorites", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data: userData } = await supabaseAuth.auth.getUser();
    if (!userData?.user) {
      return res.status(401).json({ error: "Usuario inválido" });
    }

    const user_id = userData.user.id;

    // 1. traer favoritos
    const { data: favs, error } = await supabase
      .from("favorites")
      .select("auction_id")
      .eq("user_id", user_id);

    if (error) return res.status(500).json({ error: error.message });

    const ids = favs.map(f => f.auction_id);

    // 2. traer subastas de esos favoritos
    const { data: subastas } = await supabase
  .from("auctions")
  .select("*")
  .in("id", ids);

// 🔥 FILTRAR FINALIZADAS
const ahora = new Date();

const activas = (subastas || []).filter(s => {
  const fin = new Date(s.fecha_fin);

  if (!s.fecha_fin || isNaN(fin)) return false;

  return ahora < fin;
});

res.json(activas);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/favorites/cleanup", async (req, res) => {
  try {
    // traer favoritos
    const { data: favoritos } = await supabase
      .from("favorites")
      .select("*");

    if (!favoritos || favoritos.length === 0) {
      return res.json({ msg: "No hay favoritos" });
    }

    // traer subastas
    const { data: subastas } = await supabase
      .from("auctions")
      .select("id, fecha_fin");

    const ahora = new Date();

    let eliminados = 0;

    for (const fav of favoritos) {

      const subasta = subastas.find(s => s.id === fav.auction_id);
      if (!subasta) continue;

      const fin = new Date(subasta.fecha_fin);

      // 🔥 si terminó → eliminar favorito
      if (ahora > fin) {
        await supabase
          .from("favorites")
          .delete()
          .eq("id", fav.id);

        eliminados++;
      }
    }

    res.json({ msg: "Limpieza completa", eliminados });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// =========================
// NOTIFICACIONES
// =========================
app.get("/notificaciones", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData.user;

    // 🔥 TRAER OCULTAS
    const { data: ocultos } = await supabase
      .from("ocultos")
      .select("ref_id")
      .eq("user_id", user.id)
      .eq("tipo", "notificacion");

    const ocultasIds = (ocultos || []).map(o => o.ref_id);

    // 🔥 todas las preguntas
    const { data: preguntas } = await supabase
      .from("questions")
      .select("*");

    // 🔥 todas las subastas
    const { data: subastas } = await supabase
      .from("auctions")
      .select("*");

    let notificaciones = [];

    for (const q of preguntas) {
      const subasta = subastas.find(s => s.id === q.auction_id);
      if (!subasta) continue;

      // 📩 pregunta en mi subasta
      if (subasta.user_id === user.id && q.user_id !== user.id) {
        const id = q.id + "_pregunta";

        if (!ocultasIds.includes(id)) {
          notificaciones.push({
            id,
            texto: `Te preguntaron en: ${subasta.titulo}`,
            auction_id: subasta.id
          });
        }
      }

      // 💬 respondieron mi pregunta
      if (q.user_id === user.id && q.answer) {
        const id = q.id + "_respuesta";

        if (!ocultasIds.includes(id)) {
          notificaciones.push({
            id,
            texto: `Respondieron tu pregunta en: ${subasta.titulo}`,
            auction_id: subasta.id
          });
        }
      }
    }

    res.json(notificaciones);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/favorites", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData.user;

    const { auction_id } = req.body;

    const { data, error } = await supabase
      .from("favorites")
      .insert([{
        user_id: user.id,
        auction_id
      }]);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ msg: "OK", data });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/mis-favoritos", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();

    if (userError || !userData.user) {
      return res.status(401).json({ error: "Usuario inválido" });
    }

    const user = userData.user;

    // 🔥 traer favoritos
    const { data: favoritos, error } = await supabase
      .from("favorites")
      .select("auction_id")
      .eq("user_id", user.id);

    if (error) return res.status(500).json({ error: error.message });

    res.json(favoritos);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/favorites", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    // 👉 usar supabase con token
    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();

    if (userError || !userData.user) {
      return res.status(401).json({ error: "Usuario inválido" });
    }

    const user = userData.user;

    const { auction_id } = req.body;
    if (!auction_id) {
      return res.status(400).json({ error: "Falta auction_id" });
    }

    // =========================
    // 🔍 VER SI YA EXISTE
    // =========================
    const { data: existente } = await supabase
      .from("favorites")
      .select("*")
      .eq("user_id", user.id)
      .eq("auction_id", auction_id)
      .single();

    // =========================
    // ❌ SI EXISTE → ELIMINAR
    // =========================
    if (existente) {
      await supabase
        .from("favorites")
        .delete()
        .eq("id", existente.id);

      return res.json({ msg: "Favorito eliminado", favorito: false });
    }

    // =========================
    // ✅ SI NO EXISTE → CREAR
    // =========================
    await supabase
      .from("favorites")
      .insert([{
        user_id: user.id,
        auction_id
      }]);

    return res.json({ msg: "Favorito agregado", favorito: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// SERVER
// =========================
app.post("/subastas/ocultar", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();

    if (userError || !userData.user) {
      return res.status(401).json({ error: "Usuario inválido" });
    }

    const user_id = userData.user.id;
    const { subasta_id } = req.body;

    if (!subasta_id) {
      return res.status(400).json({ error: "Falta subasta_id" });
    }

    const { error } = await supabase
      .from("subastas_ocultas")
      .insert([{
        user_id,
        subasta_id
      }]);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ msg: "Subasta ocultada" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// OCULTAR SUBASTA FINALIZADA / GANADA
// =========================
app.post("/ocultar-subasta", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();

    if (userError || !userData.user) {
      return res.status(401).json({ error: "Usuario inválido" });
    }

    const user_id = userData.user.id;
    const { auction_id } = req.body;

    if (!auction_id) {
      return res.status(400).json({ error: "Falta auction_id" });
    }

    // ✅ USAR TABLA CORRECTA Y CAMPOS CORRECTOS
    const { error } = await supabase
      .from("ocultos")
      .insert([
        {
          user_id,
          ref_id: auction_id,
          tipo: "subasta"
        }
      ]);

    if (error) {
      console.log("ERROR OCULTAR:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ msg: "Subasta ocultada" });

  } catch (err) {
    console.log("ERROR GENERAL:", err);
    res.status(500).json({ error: err.message });
  }
});
app.post("/ocultar-notificacion", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();

    if (userError || !userData.user) {
      return res.status(401).json({ error: "Usuario inválido" });
    }

    const user_id = userData.user.id;
    const { notificacion_id } = req.body;

    if (!notificacion_id) {
      return res.status(400).json({ error: "Falta notificacion_id" });
    }

    const { error } = await supabase
      .from("ocultos")
      .insert([
        {
          user_id,
          ref_id: notificacion_id,
          tipo: "notificacion"
        }
      ]);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ msg: "Notificación ocultada" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/mis-ganadas", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });

    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // 🔐 usuario actual
    const { data: userData } = await supabaseAuth.auth.getUser();
    const user = userData.user;

    // 🔥 TRAER SUBASTAS OCULTAS POR EL USUARIO
const { data: ocultos } = await supabase
  .from("ocultos")
  .select("ref_id")
  .eq("user_id", user.id)
  .eq("tipo", "subasta");

const ocultasIds = (ocultos || []).map(o => String(o.ref_id));

    // 🧾 todas las subastas
    const { data: subastas } = await supabase
      .from("auctions")
      .select("*");

    // 👤 todos los perfiles
    const { data: perfiles } = await supabase
      .from("profiles")
      .select("id, username, telefono");

    let ganadas = [];

    for (const s of subastas) {

      // ❌ si está oculta, la salteo
if (ocultasIds.includes(String(s.id))) continue;

      if (s.user_id === user.id) continue;

      const ahora = new Date();
      const fin = new Date(s.fecha_fin + "Z");

      if (ahora < fin) continue;

      // 🔥 bids de esa subasta
      const { data: bids } = await supabase
        .from("bids")
        .select("*")
        .eq("auction_id", s.id)
        .order("monto", { ascending: false });

      if (!bids || bids.length === 0) continue;

      const ultima = bids[0];

      if (ultima.user_id === user.id) {

        // 🔥 vendedor
        const vendedor = perfiles.find(p => p.id === s.user_id);

        ganadas.push({
          id: s.id,
          titulo: s.titulo,
          monto: ultima.monto,
          vendedor: vendedor?.username || "Vendedor",
          telefono: vendedor?.telefono || "-"
        });
      }
    }

    res.json(ganadas);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => console.log("Servidor corriendo en http://localhost:5000"));
