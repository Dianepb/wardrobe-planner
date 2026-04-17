import { useState, useEffect, useRef } from "react";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth, signInWithGoogle, signOutUser, onAuthChange } from "./firebase";

const CATEGORIES = ["Top", "Bottom", "Shoes", "Accessory", "Outerwear"];
const STYLES = ["Casual", "Formal", "Sporty", "Chic", "Bohemian", "Smart casual"];
const COLORS = ["Black", "White", "Grey", "Navy", "Blue", "Red", "Green", "Beige", "Brown", "Pink", "Yellow", "Orange", "Purple", "Multicolor"];
const MATERIALS = ["Cotton", "Wool", "Silk", "Linen", "Denim", "Leather", "Synthetic", "Cashmere", "Velvet", "Polyester"];
const TEMPS = ["Cold", "Mild", "Warm", "Hot"];
const TEMP_COMPAT = { Cold: ["Cold"], Mild: ["Cold", "Mild"], Warm: ["Mild", "Warm"], Hot: ["Warm", "Hot"] };
const CAT_COMBOS = [
  ["Top", "Bottom", "Shoes"],
  ["Top", "Bottom", "Shoes", "Outerwear"],
  ["Top", "Bottom", "Shoes", "Accessory"],
  ["Top", "Bottom", "Shoes", "Outerwear", "Accessory"],
];

function uuid() { return Math.random().toString(36).slice(2, 10); }
function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// ── Clothing Card ──────────────────────────────────────────────
function ClothingCard({ item, onEdit, onDelete }) {
  const days = daysSince(item.lastWorn);
  return (
    <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 140, background: "#f5f5f4", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {item.photoUrl
          ? <img src={item.photoUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 40 }}>👕</span>}
      </div>
      <div style={{ padding: "10px 12px", flex: 1 }}>
        <div style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{item.category} · {item.color} · {item.style}</div>
        <div style={{ fontSize: 12, color: "#666" }}>{item.material} · {item.temperature}</div>
        {days < 999 && <div style={{ fontSize: 11, color: days < 2 ? "#e24b4a" : "#999", marginTop: 4 }}>
          {days === 0 ? "Worn today" : days === 1 ? "Worn yesterday" : `Worn ${days}d ago`}
        </div>}
      </div>
      <div style={{ display: "flex", borderTop: "0.5px solid #e5e5e5" }}>
        <button onClick={() => onEdit(item)} style={btnStyle}>Edit</button>
        <button onClick={() => onDelete(item.id)} style={{ ...btnStyle, color: "#e24b4a" }}>Delete</button>
      </div>
    </div>
  );
}
const btnStyle = { flex: 1, padding: "7px 0", fontSize: 12, background: "none", border: "none", cursor: "pointer", color: "#666" };

// ── Item Form ──────────────────────────────────────────────────
function ItemForm({ initial, userId, onSave, onCancel }) {
  const blank = { name: "", category: "Top", color: "Black", style: "Casual", material: "Cotton", temperature: "Mild", photoUrl: "" };
  const [form, setForm] = useState(initial || blank);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const storageRef = ref(storage, `users/${userId}/clothes/${uuid()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    set("photoUrl", url);
    setUploading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={labelStyle}>Name</label>
          <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Blue Oxford Shirt" style={{ width: "100%", marginTop: 4 }} />
        </div>
        {[["Category", "category", CATEGORIES], ["Style", "style", STYLES], ["Color", "color", COLORS], ["Material", "material", MATERIALS], ["Temperature", "temperature", TEMPS]].map(([lbl, key, opts]) => (
          <div key={key}>
            <label style={labelStyle}>{lbl}</label>
            <select value={form[key]} onChange={e => set(key, e.target.value)} style={{ width: "100%", marginTop: 4 }}>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <div>
          <label style={labelStyle}>Photo</label>
          <input type="file" accept="image/*" ref={fileRef} onChange={handleFile} style={{ display: "none" }} />
          <button onClick={() => fileRef.current.click()} style={{ width: "100%", marginTop: 4, fontSize: 13 }} disabled={uploading}>
            {uploading ? "Uploading..." : form.photoUrl ? "Change photo" : "Upload photo"}
          </button>
        </div>
        {form.photoUrl && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={form.photoUrl} alt="preview" style={{ height: 60, borderRadius: 6, objectFit: "cover" }} />
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ fontSize: 13 }}>Cancel</button>
        <button onClick={() => form.name && !uploading && onSave(form)} disabled={!form.name || uploading} style={{ fontSize: 13, fontWeight: 500 }}>Save item</button>
      </div>
    </div>
  );
}
const labelStyle = { fontSize: 12, color: "#666" };

// ── Outfit Card ────────────────────────────────────────────────
function OutfitCard({ combo, onWear, aiDesc, isLoading }) {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${combo.length}, 1fr)` }}>
        {combo.map((item, i) => (
          <div key={item.id} style={{ borderRight: i < combo.length - 1 ? "0.5px solid #e5e5e5" : "none" }}>
            <div style={{ height: 110, background: "#f5f5f4", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {item.photoUrl ? <img src={item.photoUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 28 }}>👕</span>}
            </div>
            <div style={{ padding: "6px 8px" }}>
              <div style={{ fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
              <div style={{ fontSize: 10, color: "#888" }}>{item.category}</div>
              {daysSince(item.lastWorn) < 3 && <div style={{ fontSize: 10, color: "#e24b4a" }}>Worn recently</div>}
            </div>
          </div>
        ))}
      </div>
      {(isLoading || aiDesc) && (
        <div style={{ padding: "10px 14px", borderTop: "0.5px solid #e5e5e5", fontSize: 13, color: "#555", fontStyle: isLoading ? "italic" : "normal", lineHeight: 1.6 }}>
          {isLoading ? "Generating outfit description..." : aiDesc}
        </div>
      )}
      <div style={{ padding: "8px 12px", borderTop: "0.5px solid #e5e5e5" }}>
        <button onClick={() => onWear(combo)} style={{ fontSize: 12, width: "100%" }}>Mark as worn today</button>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("wardrobe");
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [prefs, setPrefs] = useState({ style: "Casual", color: "", temperature: "Mild", avoidRecent: true });
  const [combos, setCombos] = useState([]);
  const [aiDescs, setAiDescs] = useState({});
  const [loadingDescs, setLoadingDescs] = useState({});
  const [searched, setSearched] = useState(false);

  // Auth + Firestore listener
  useEffect(() => {
    const unsub = onAuthChange(u => {
      setUser(u);
      if (u) {
        const col = collection(db, "users", u.uid, "clothes");
        onSnapshot(col, snap => {
          setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
      } else {
        setItems([]);
      }
    });
    return () => unsub();
  }, []);

  async function handleSave(form) {
    const id = editItem ? editItem.id : uuid();
    await setDoc(doc(db, "users", user.uid, "clothes", id), { ...form, lastWorn: editItem?.lastWorn || null });
    setShowForm(false); setEditItem(null);
  }

  async function handleDelete(id) {
    await deleteDoc(doc(db, "users", user.uid, "clothes", id));
  }

  function handleEdit(item) { setEditItem(item); setShowForm(true); }

  async function markWorn(combo) {
    const today = new Date().toISOString().slice(0, 10);
    for (const item of combo) {
      await setDoc(doc(db, "users", user.uid, "clothes", item.id), { ...item, lastWorn: today });
    }
    setCombos(c => c.filter(cc => cc !== combo));
  }

  function findCombos() {
    const compat = TEMP_COMPAT[prefs.temperature] || [prefs.temperature];
    const pool = items.filter(item => {
      if (item.style !== prefs.style) return false;
      if (!compat.includes(item.temperature)) return false;
      if (prefs.color && item.color !== prefs.color && item.color !== "Multicolor") return false;
      if (prefs.avoidRecent && daysSince(item.lastWorn) < 2) return false;
      return true;
    });
    const byCategory = {};
    CATEGORIES.forEach(c => { byCategory[c] = pool.filter(i => i.category === c); });
    const results = [];
    for (const template of CAT_COMBOS) {
      if (template.every(cat => (byCategory[cat] || []).length > 0)) {
        const pick = template.map(cat => byCategory[cat][Math.floor(Math.random() * byCategory[cat].length)]);
        const key = pick.map(i => i.id).sort().join("-");
        if (!results.find(r => r.map(i => i.id).sort().join("-") === key)) results.push(pick);
      }
      if (results.length >= 3) break;
    }
    setCombos(results); setAiDescs({}); setSearched(true);
    results.forEach((combo, idx) => generateDesc(combo, idx));
  }

  async function generateDesc(combo, idx) {
    setLoadingDescs(p => ({ ...p, [idx]: true }));
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("https://getoutfitdescription-j53peiiowa-uc.a.run.app/getOutfitDescription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ combo, style: prefs.style }),
      });
      const data = await res.json();
      setAiDescs(p => ({ ...p, [idx]: data.description || "" }));
    } catch {
      setAiDescs(p => ({ ...p, [idx]: "A thoughtfully curated combination for the day ahead." }));
    }
    setLoadingDescs(p => ({ ...p, [idx]: false }));
  }

  const tabBtn = (t, label) => (
    <button onClick={() => setTab(t)} style={{
      padding: "8px 20px", fontSize: 14, fontWeight: tab === t ? 500 : 400,
      background: "none", border: "none",
      borderBottom: tab === t ? "2px solid #111" : "2px solid transparent",
      cursor: "pointer", color: tab === t ? "#111" : "#888"
    }}>{label}</button>
  );

  if (!user) {
    return (
      <>
        <style>{`* { box-sizing: border-box; } body { font-family: system-ui, sans-serif; margin: 0; background: #fff; color: #111; } button { padding: 8px 16px; border: 0.5px solid #ccc; border-radius: 8px; font-size: 13px; cursor: pointer; background: #fff; color: #111; } button:hover { background: #f5f5f4; }`}</style>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>My Wardrobe</h1>
          <p style={{ color: "#888", fontSize: 14, margin: 0 }}>Sign in to access your wardrobe from any device</p>
          <button onClick={signInWithGoogle} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="" />
            Sign in with Google
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { font-family: system-ui, sans-serif; margin: 0; background: #fff; color: #111; }
        input, select { padding: 7px 10px; border: 0.5px solid #ccc; border-radius: 8px; font-size: 13px; outline: none; }
        input:focus, select:focus { border-color: #888; }
        button { padding: 8px 16px; border: 0.5px solid #ccc; border-radius: 8px; font-size: 13px; cursor: pointer; background: #fff; color: #111; }
        button:hover { background: #f5f5f4; }
        button:disabled { opacity: 0.5; cursor: default; }
        .card { background: #fff; border: 0.5px solid #e5e5e5; border-radius: 12px; }
      `}</style>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem 1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>My Wardrobe</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {user.photoURL && <img src={user.photoURL} alt="" width="28" height="28" style={{ borderRadius: "50%" }} />}
            <button onClick={signOutUser} style={{ fontSize: 12, padding: "4px 10px" }}>Sign out</button>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "#888", margin: "0 0 1.5rem" }}>{items.length} items saved</p>

        <div style={{ display: "flex", borderBottom: "0.5px solid #e5e5e5", marginBottom: "1.5rem" }}>
          {tabBtn("wardrobe", "Wardrobe")}
          {tabBtn("outfit", "Outfit picker")}
        </div>

        {tab === "wardrobe" && (
          <>
            {!showForm && (
              <button onClick={() => { setShowForm(true); setEditItem(null); }} style={{ marginBottom: "1.5rem", fontWeight: 500, fontSize: 13 }}>
                + Add clothing item
              </button>
            )}
            {showForm && (
              <div style={{ background: "#f9f9f8", borderRadius: 12, padding: "1.25rem", marginBottom: "1.5rem" }}>
                <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 12 }}>{editItem ? "Edit item" : "New item"}</div>
                <ItemForm initial={editItem} userId={user.uid} onSave={handleSave} onCancel={() => { setShowForm(false); setEditItem(null); }} />
              </div>
            )}
            {items.length === 0 && !showForm && (
              <div style={{ textAlign: "center", padding: "3rem", color: "#888", fontSize: 14 }}>
                No items yet. Add your first piece of clothing to get started.
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              {items.map(item => <ClothingCard key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} />)}
            </div>
          </>
        )}

        {tab === "outfit" && (
          <>
            <div style={{ background: "#f9f9f8", borderRadius: 12, padding: "1.25rem", marginBottom: "1.5rem" }}>
              <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 12 }}>Today's preferences</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                {[["Style", "style", STYLES], ["Color mood", "color", ["Any", ...COLORS]], ["Temperature", "temperature", TEMPS]].map(([lbl, key, opts]) => (
                  <div key={key}>
                    <label style={labelStyle}>{lbl}</label>
                    <select value={prefs[key] || "Any"} onChange={e => setPrefs(p => ({ ...p, [key]: e.target.value === "Any" ? "" : e.target.value }))} style={{ width: "100%", marginTop: 4 }}>
                      {opts.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 16 }}>
                  <input type="checkbox" id="avoid" checked={prefs.avoidRecent} onChange={e => setPrefs(p => ({ ...p, avoidRecent: e.target.checked }))} />
                  <label htmlFor="avoid" style={{ fontSize: 13, color: "#666" }}>Avoid recently worn</label>
                </div>
              </div>
              <button onClick={findCombos} style={{ fontWeight: 500, fontSize: 13, width: "100%" }}>Find outfits</button>
            </div>
            {searched && combos.length === 0 && (
              <div style={{ textAlign: "center", padding: "2rem", color: "#888", fontSize: 14 }}>
                No combinations found. Try adjusting preferences or adding more items.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {combos.map((combo, idx) => (
                <OutfitCard key={idx} combo={combo} onWear={markWorn} aiDesc={aiDescs[idx]} isLoading={loadingDescs[idx]} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}