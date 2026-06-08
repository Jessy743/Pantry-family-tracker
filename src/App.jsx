import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "family-pantry-inventory";

const LOCATIONS = {
  pantry: { label: "Pantry", emoji: "🏠", color: "#8B6914" },
  fridge: { label: "Fridge", emoji: "❄️", color: "#2D7DD2" },
  freezer: { label: "Freezer", emoji: "🧊", color: "#5B4FC9" },
};

const CATEGORIES = {
  produce: "🥦 Produce",
  dairy: "🥛 Dairy",
  meat: "🥩 Meat & Seafood",
  grains: "🌾 Grains & Bread",
  canned: "🥫 Canned & Jarred",
  snacks: "🍿 Snacks",
  condiments: "🧴 Condiments",
  beverages: "🥤 Beverages",
  frozen: "🧊 Frozen Foods",
  baking: "🥣 Baking",
  spices: "🌶️ Spices & Herbs",
  other: "📦 Other",
};

const UNITS = ["pcs", "lbs", "oz", "g", "kg", "L", "mL", "cups", "bags", "boxes", "cans", "jars", "bottles"];

const getExpiryStatus = (dateStr) => {
  if (!dateStr) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr);
  const diff = Math.floor((exp - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "expired";
  if (diff <= 3) return "critical";
  if (diff <= 7) return "warning";
  return "good";
};

const expiryColors = {
  none: "#94a3b8",
  good: "#22c55e",
  warning: "#f59e0b",
  critical: "#ef4444",
  expired: "#7f1d1d",
};

const expiryLabels = {
  none: "No date",
  good: "Good",
  warning: "Expiring soon",
  critical: "Expiring soon!",
  expired: "Expired",
};

function formatExpiry(dateStr) {
  if (!dateStr) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr);
  const diff = Math.floor((exp - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `Expired ${Math.abs(diff)}d ago`;
  if (diff === 0) return "Expires today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 30) return `${diff} days`;
  return exp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const defaultForm = {
  name: "",
  quantity: "",
  unit: "pcs",
  barcode: "",
  location: "pantry",
  category: "other",
  expiration: "",
  notes: "",
};

export default function PantryTracker() {
  const [items, setItems] = useState([]);
  const [view, setView] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterExpiry, setFilterExpiry] = useState("all");
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const barcodeRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setItems(JSON.parse(saved));
  }, []);

  const saveItems = (newItems) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    let newItems;
    if (editId !== null) {
      newItems = items.map((i) => (i.id === editId ? { ...form, id: editId } : i));
      showToast("Item updated!");
    } else {
      const newItem = { ...form, id: Date.now() };
      newItems = [...items, newItem];
      showToast("Item added!");
    }
    setItems(newItems);
    saveItems(newItems);
    setForm(defaultForm);
    setEditId(null);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setForm({ ...item });
    setEditId(item.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (id) => {
    const newItems = items.filter((i) => i.id !== id);
    setItems(newItems);
    saveItems(newItems);
    setDeleteConfirm(null);
    showToast("Item removed.", "info");
  };

  const handleBarcodeInput = (e) => {
    setForm((f) => ({ ...f, barcode: e.target.value }));
  };

  const handleBarcodeKey = (e) => {
    if (e.key === "Enter" && form.barcode) {
      setScanning(false);
      showToast("Barcode captured: " + form.barcode, "info");
    }
  };

  const filteredItems = items
    .filter((i) => {
      if (view !== "all" && i.location !== view) return false;
      if (filterCategory !== "all" && i.category !== filterCategory) return false;
      if (filterExpiry !== "all" && getExpiryStatus(i.expiration) !== filterExpiry) return false;
      if (search && !i.name.toLowerCase().includes(search.toLowerCase()) &&
        !i.barcode?.includes(search)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "expiry") {
        if (!a.expiration) return 1;
        if (!b.expiration) return -1;
        return new Date(a.expiration) - new Date(b.expiration);
      }
      if (sortBy === "category") return a.category.localeCompare(b.category);
      return 0;
    });

  const grouped = filteredItems.reduce((acc, item) => {
    const key = sortBy === "category" ? item.category : item.location;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const expiringSoon = items.filter((i) => {
    const s = getExpiryStatus(i.expiration);
    return s === "critical" || s === "warning" || s === "expired";
  });

  const counts = {
    all: items.length,
    pantry: items.filter((i) => i.location === "pantry").length,
    fridge: items.filter((i) => i.location === "fridge").length,
    freezer: items.filter((i) => i.location === "freezer").length,
  };

  return (
    <div style={{
      fontFamily: "'Georgia', 'Times New Roman', serif",
      background: "linear-gradient(135deg, #fdf6ec 0%, #f5ede0 100%)",
      minHeight: "100vh",
      color: "#2c1810",
    }}>
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: toast.type === "success" ? "#3d7a3d" : toast.type === "info" ? "#2D7DD2" : "#c0392b",
          color: "white", padding: "12px 20px", borderRadius: 8,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          fontFamily: "'Georgia', serif", fontSize: 14, fontWeight: 600,
        }}>
          {toast.msg}
        </div>
      )}

      {deleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9998,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#fdf6ec", borderRadius: 16, padding: 32, maxWidth: 340,
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)", textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>Remove Item?</h3>
            <p style={{ color: "#7a5c44", marginBottom: 24, fontSize: 14 }}>
              This will permanently remove <strong>{deleteConfirm.name}</strong> from the inventory.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{
                padding: "10px 20px", borderRadius: 8, border: "2px solid #c9a96e",
                background: "transparent", color: "#8B6914", cursor: "pointer", fontFamily: "Georgia",
              }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} style={{
                padding: "10px 20px", borderRadius: 8, border: "none",
                background: "#c0392b", color: "white", cursor: "pointer", fontFamily: "Georgia", fontWeight: 700,
              }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        background: "linear-gradient(135deg, #8B4513 0%, #A0522D 50%, #8B6914 100%)",
        padding: "24px 20px 20px",
        boxShadow: "0 4px 20px rgba(139,69,19,0.3)",
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <span style={{ fontSize: 32 }}>🏡</span>
            <div>
              <h1 style={{
                margin: 0, color: "#fdf6ec", fontSize: 26, fontWeight: 700,
                letterSpacing: "-0.5px", textShadow: "0 2px 4px rgba(0,0,0,0.2)",
              }}>Family Food Inventory</h1>
              <p style={{ margin: 0, color: "#f5c89a", fontSize: 13 }}>
                Shared across all family members · {items.length} total items
              </p>
            </div>
          </div>
          {expiringSoon.length > 0 && (
            <div style={{
              marginTop: 14, background: "rgba(255,255,255,0.15)", borderRadius: 10,
              padding: "10px 14px", borderLeft: "4px solid #f59e0b",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <span style={{ color: "#fef3c7", fontSize: 13, fontFamily: "Georgia" }}>
                <strong>{expiringSoon.length} item{expiringSoon.length > 1 ? "s" : ""}</strong> expiring soon or expired:{" "}
                {expiringSoon.slice(0, 3).map((i) => i.name).join(", ")}
                {expiringSoon.length > 3 && ` +${expiringSoon.length - 3} more`}
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
          {[["all", "🗂️", "All Items"], ...Object.entries(LOCATIONS).map(([k, v]) => [k, v.emoji, v.label])].map(([key, emoji, label]) => (
            <button key={key} onClick={() => setView(key)} style={{
              padding: "10px 18px", borderRadius: 50, border: "2px solid",
              borderColor: view === key ? (LOCATIONS[key]?.color || "#8B4513") : "#d4b896",
              background: view === key ? (LOCATIONS[key]?.color || "#8B4513") : "white",
              color: view === key ? "white" : "#7a5c44",
              cursor: "pointer", whiteSpace: "nowrap", fontFamily: "Georgia",
              fontSize: 13, fontWeight: view === key ? 700 : 500,
              boxShadow: view === key ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
            }}>
              {emoji} {label}
              <span style={{
                marginLeft: 6, background: view === key ? "rgba(255,255,255,0.3)" : "#f0e4d4",
                borderRadius: 20, padding: "1px 8px", fontSize: 11,
                color: view === key ? "white" : "#8B4513",
              }}>{counts[key] ?? 0}</span>
            </button>
          ))}
        </div>

        {showForm && (
          <div style={{
            background: "white", borderRadius: 16, padding: 24,
            boxShadow: "0 8px 30px rgba(139,69,19,0.15)", marginBottom: 20,
            border: "2px solid #e8d5bc",
          }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, color: "#5c3317" }}>
              {editId !== null ? "✏️ Edit Item" : "➕ Add New Item"}
            </h2>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle}>Item Name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Whole Milk, Chicken Breast..." style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Quantity</label>
                  <input type="number" min="0" value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    placeholder="e.g. 2" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Unit</label>
                  <select value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} style={inputStyle}>
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Storage Location</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {Object.entries(LOCATIONS).map(([key, val]) => (
                    <button key={key} type="button" onClick={() => setForm((f) => ({ ...f, location: key }))} style={{
                      flex: 1, padding: "10px 8px", borderRadius: 8, border: "2px solid",
                      borderColor: form.location === key ? val.color : "#d4b896",
                      background: form.location === key ? val.color : "transparent",
                      color: form.location === key ? "white" : "#7a5c44",
                      cursor: "pointer", fontFamily: "Georgia", fontSize: 13, fontWeight: 600,
                    }}>{val.emoji} {val.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={inputStyle}>
                  {Object.entries(CATEGORIES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Expiration Date</label>
                <input type="date" value={form.expiration}
                  onChange={(e) => setForm((f) => ({ ...f, expiration: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Barcode (optional)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input ref={barcodeRef} value={form.barcode}
                    onChange={handleBarcodeInput} onKeyDown={handleBarcodeKey}
                    placeholder="Scan or type barcode..." style={{ ...inputStyle, flex: 1 }} />
                  <button type="button" onClick={() => { setScanning(true); barcodeRef.current?.focus(); }} style={{
                    padding: "0 14px", borderRadius: 8, border: "2px solid #c9a96e",
                    background: scanning ? "#8B6914" : "transparent",
                    color: scanning ? "white" : "#8B6914", cursor: "pointer", fontSize: 18,
                  }}>📷</button>
                </div>
                {scanning && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8B6914" }}>
                  Point scanner at barcode or type manually, then press Enter
                </p>}
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Brand, variety, or other notes..." style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={() => { setShowForm(false); setForm(defaultForm); setEditId(null); }} style={{
                  flex: 1, padding: "12px", borderRadius: 8, border: "2px solid #c9a96e",
                  background: "transparent", color: "#8B4513", cursor: "pointer", fontFamily: "Georgia", fontWeight: 600,
                }}>Cancel</button>
                <button onClick={handleSubmit} style={{
                  flex: 2, padding: "12px", borderRadius: 8, border: "none",
                  background: "linear-gradient(135deg, #8B4513, #A0522D)",
                  color: "white", cursor: "pointer", fontFamily: "Georgia", fontWeight: 700, fontSize: 15,
                  boxShadow: "0 4px 12px rgba(139,69,19,0.3)",
                }}>{editId !== null ? "Save Changes" : "Add to Inventory"}</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search items or barcode..."
            style={{ ...inputStyle, flex: "1 1 180px", minWidth: 0 }} />
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
            style={{ ...inputStyle, flex: "0 0 140px" }}>
            <option value="all">All Categories</option>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterExpiry} onChange={(e) => setFilterExpiry(e.target.value)}
            style={{ ...inputStyle, flex: "0 0 130px" }}>
            <option value="all">All Status</option>
            <option value="expired">Expired</option>
            <option value="critical">Critical</option>
            <option value="warning">Expiring Soon</option>
            <option value="good">Good</option>
            <option value="none">No Date</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            style={{ ...inputStyle, flex: "0 0 120px" }}>
            <option value="name">Sort: Name</option>
            <option value="expiry">Sort: Expiry</option>
            <option value="category">Sort: Category</option>
          </select>
          {!showForm && (
            <button onClick={() => { setShowForm(true); setForm(defaultForm); setEditId(null); }} style={{
              padding: "10px 18px", borderRadius: 8, border: "none",
              background: "linear-gradient(135deg, #8B4513, #A0522D)",
              color: "white", cursor: "pointer", fontFamily: "Georgia", fontWeight: 700,
              fontSize: 14, whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(139,69,19,0.3)",
            }}>+ Add Item</button>
          )}
        </div>

        {filteredItems.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            background: "white", borderRadius: 16, color: "#a07858",
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
            <h3 style={{ margin: "0 0 8px" }}>No items found</h3>
            <p style={{ margin: 0, fontSize: 14 }}>
              {items.length === 0 ? "Add your first item to get started!" : "Try adjusting your filters."}
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([groupKey, groupItems]) => {
            const isLocationGroup = sortBy !== "category";
            const locInfo = LOCATIONS[groupKey];
            const catLabel = CATEGORIES[groupKey];
            return (
              <div key={groupKey} style={{ marginBottom: 24 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
                  paddingBottom: 8, borderBottom: `2px solid ${locInfo?.color || "#d4b896"}22`,
                }}>
                  <span style={{ fontSize: 20 }}>{isLocationGroup ? locInfo?.emoji : catLabel?.split(" ")[0]}</span>
                  <h3 style={{
                    margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: "0.05em",
                    textTransform: "uppercase", color: locInfo?.color || "#8B4513",
                  }}>
                    {isLocationGroup ? locInfo?.label : catLabel?.replace(/^.\s/, "")}
                  </h3>
                  <span style={{
                    marginLeft: "auto", fontSize: 12, color: "#a07858",
                    background: "#f0e4d4", padding: "2px 10px", borderRadius: 20,
                  }}>{groupItems.length} item{groupItems.length !== 1 ? "s" : ""}</span>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {groupItems.map((item) => {
                    const expStatus = getExpiryStatus(item.expiration);
                    const locData = LOCATIONS[item.location];
                    return (
                      <div key={item.id} style={{
                        background: "white", borderRadius: 12, padding: "14px 16px",
                        boxShadow: "0 2px 8px rgba(139,69,19,0.08)",
                        border: expStatus === "expired" ? "2px solid #ef444444"
                          : expStatus === "critical" ? "2px solid #f59e0b44"
                          : "2px solid transparent",
                        display: "flex", alignItems: "center", gap: 12,
                      }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                          background: locData.color,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: "#2c1810" }}>{item.name}</span>
                            {item.quantity && (
                              <span style={{
                                fontSize: 12, color: "white", background: locData.color,
                                padding: "1px 8px", borderRadius: 20, fontWeight: 600,
                              }}>{item.quantity} {item.unit}</span>
                            )}
                            <span style={{ fontSize: 12, color: "#a07858" }}>{CATEGORIES[item.category]}</span>
                          </div>
                          <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                            {item.expiration && (
                              <span style={{
                                fontSize: 12, color: expiryColors[expStatus],
                                fontWeight: expStatus !== "good" ? 700 : 400,
                              }}>
                                📅 {formatExpiry(item.expiration)}
                              </span>
                            )}
                            {item.barcode && (
                              <span style={{ fontSize: 12, color: "#a07858" }}>🔢 {item.barcode}</span>
                            )}
                            {item.notes && (
                              <span style={{ fontSize: 12, color: "#a07858", fontStyle: "italic" }}>{item.notes}</span>
                            )}
                          </div>
                        </div>
                        <div style={{
                          fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                          color: expiryColors[expStatus], flexShrink: 0,
                          display: expStatus !== "none" && expStatus !== "good" ? "block" : "none",
                        }}>
                          {expStatus === "expired" ? "❌ EXPIRED" : "⚠️"}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => handleEdit(item)} style={{
                            width: 32, height: 32, borderRadius: 8, border: "1.5px solid #d4b896",
                            background: "transparent", cursor: "pointer", fontSize: 14,
                          }}>✏️</button>
                          <button onClick={() => setDeleteConfirm(item)} style={{
                            width: 32, height: 32, borderRadius: 8, border: "1.5px solid #fca5a5",
                            background: "transparent", cursor: "pointer", fontSize: 14,
                          }}>🗑️</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        <div style={{
          marginTop: 32, textAlign: "center", color: "#c9a96e",
          fontSize: 12, paddingBottom: 20,
        }}>
          🏡 Family Food Inventory · Data shared across all family members
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "2px solid #e8d5bc", fontFamily: "Georgia, serif",
  fontSize: 14, background: "#fdfaf5", color: "#2c1810",
  boxSizing: "border-box", outline: "none",
};

const labelStyle = {
  display: "block", marginBottom: 6, fontSize: 13,
  fontWeight: 700, color: "#7a5c44", letterSpacing: "0.03em",
};
