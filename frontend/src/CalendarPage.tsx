import { useState, useEffect } from "react";

interface Booking {
  id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  service_id?: string;
  service_name?: string;
  service_price?: number;
  date: string;
  time: string;
  status: string;
  created_at?: string;
}

interface CalendarPageProps {
  businessId: string;
  token: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-green-500/10 text-green-400 border border-green-500/20",
  pending: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  cancelled: "bg-red-500/10 text-red-400 border border-red-500/20",
  completed: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
};

const STATUS_ICONS: Record<string, string> = {
  confirmed: "✅",
  pending: "⏳",
  cancelled: "❌",
  completed: "✔️",
};

export default function CalendarPage({ businessId, token }: CalendarPageProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Manual booking form
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    serviceId: "",
    date: "",
    time: "",
  });
  const [savingBooking, setSavingBooking] = useState(false);

  // Income
  const [totalIncome, setTotalIncome] = useState(0);

  // Services for booking form
  const [services, setServices] = useState<any[]>([]);

  const t = token;

  const fetchBookings = async () => {
    if (!t) return;
    try {
      const res = await fetch("/api/bookings", { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setBookings(await res.json());
    } catch {}
  };

  const fetchIncome = async () => {
    if (!t) return;
    try {
      const res = await fetch("/api/income", { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) {
        const data = await res.json();
        setTotalIncome(data.total || 0);
      }
    } catch {}
  };

  const fetchServices = async () => {
    if (!t) return;
    try {
      const res = await fetch("/api/business/services", { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setServices(await res.json());
    } catch {}
  };

  useEffect(() => {
    if (!t) return;
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchBookings(), fetchIncome(), fetchServices()]);
      setLoading(false);
    };
    load();
  }, [t]);

  const handleStatusChange = async (id: string, status: string) => {
    if (!t) return;
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
        if (status === "completed") fetchIncome();
      }
    } catch {}
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!t || !bookingForm.customerName || !bookingForm.date || !bookingForm.time) return;
    setSavingBooking(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          customerName: bookingForm.customerName,
          customerEmail: bookingForm.customerEmail || undefined,
          customerPhone: bookingForm.customerPhone || undefined,
          serviceId: bookingForm.serviceId || undefined,
          date: bookingForm.date,
          time: bookingForm.time,
          status: "confirmed",
        }),
      });
      if (res.ok) {
        await fetchBookings();
        setShowBookingForm(false);
        setBookingForm({ customerName: "", customerEmail: "", customerPhone: "", serviceId: "", date: "", time: "" });
      }
    } catch {} finally {
      setSavingBooking(false);
    }
  };

  // Calendar helpers
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  const todayStr = new Date().toISOString().split("T")[0];

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };

  const getBookingsForDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return bookings.filter((b) => b.date === dateStr);
  };

  const getTodayBookings = () => {
    return bookings.filter((b) => b.date === todayStr);
  };

  if (loading) {
    return (
      <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-8 text-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-400 text-sm mt-4">Loading bookings...</p>
      </div>
    );
  }

  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const confirmedCount = bookings.filter((b) => b.status === "confirmed").length;
  const completedCount = bookings.filter((b) => b.status === "completed").length;
  const todayCount = getTodayBookings().length;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Calendar & Reservations</h2>
          <p className="text-sm text-slate-400">Manage bookings, availability, and income tracking.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === "calendar" ? "list" : "calendar")}
            className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition border border-slate-700"
          >
            {viewMode === "calendar" ? "📋 List View" : "📅 Calendar View"}
          </button>
          <button
            onClick={() => setShowBookingForm(true)}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
          >
            + New Booking
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400 uppercase font-semibold">Total</div>
          <div className="text-2xl font-black text-white">{bookings.length}</div>
        </div>
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-green-400 uppercase font-semibold">Confirmed</div>
          <div className="text-2xl font-black text-white">{confirmedCount}</div>
        </div>
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-yellow-400 uppercase font-semibold">Pending</div>
          <div className="text-2xl font-black text-white">{pendingCount}</div>
        </div>
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-blue-400 uppercase font-semibold">Completed</div>
          <div className="text-2xl font-black text-white">{completedCount}</div>
        </div>
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 text-center">
          <div className="text-xs text-purple-400 uppercase font-semibold">Income</div>
          <div className="text-2xl font-black text-white">${totalIncome.toFixed(2)}</div>
        </div>
      </div>

      {/* Today's appointments */}
      {todayCount > 0 && (
        <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-sm font-bold text-purple-400">
            📅 {todayCount} booking{todayCount !== 1 ? "s" : ""} scheduled for today
          </p>
        </div>
      )}

      {/* === CALENDAR VIEW === */}
      {viewMode === "calendar" && (
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden">
          {/* Month Navigation */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <button onClick={prevMonth} className="text-slate-400 hover:text-white transition px-3 py-1">←</button>
            <span className="text-lg font-bold text-white">{monthNames[currentMonth]} {currentYear}</span>
            <button onClick={nextMonth} className="text-slate-400 hover:text-white transition px-3 py-1">→</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-800">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-xs text-slate-400 font-semibold py-2">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {/* Empty spaces for first week */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] p-1 border-b border-r border-slate-800/30" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayBookings = getBookingsForDay(day);
              const isToday = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` === todayStr;

              return (
                <div
                  key={day}
                  className={`min-h-[80px] p-1 border-b border-r border-slate-800/30 ${
                    isToday ? "bg-purple-500/5" : "hover:bg-slate-800/20"
                  } transition cursor-pointer`}
                >
                  <span className={`text-xs font-semibold ${isToday ? "text-purple-400" : "text-slate-400"} px-1.5 py-0.5 rounded`}>
                    {day}
                  </span>
                  <div className="space-y-0.5 mt-1">
                    {dayBookings.slice(0, 3).map((b) => (
                      <div key={b.id} className={`text-[9px] px-1 py-0.5 rounded truncate ${
                        b.status === "confirmed" ? "bg-green-500/20 text-green-400" :
                        b.status === "completed" ? "bg-blue-500/20 text-blue-400" :
                        b.status === "cancelled" ? "bg-red-500/20 text-red-400" :
                        "bg-yellow-500/20 text-yellow-400"
                      }`}>
                        {b.time} {b.customer_name}
                      </div>
                    ))}
                    {dayBookings.length > 3 && (
                      <div className="text-[9px] text-slate-500 pl-1">+{dayBookings.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === LIST VIEW === */}
      {viewMode === "list" && (
        <div className="space-y-3">
          {bookings.length === 0 ? (
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-8 text-center space-y-3">
              <div className="text-4xl">📅</div>
              <h3 className="text-lg font-bold text-white">No Bookings Yet</h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                Bookings from your chatbot and manual entries will appear here. Create your first booking to get started.
              </p>
            </div>
          ) : (
            [...bookings]
              .sort((a, b) => (a.date > b.date ? 1 : -1))
              .map((booking) => (
                <div key={booking.id} className="bg-slate-800/30 border border-slate-800 rounded-xl p-5 flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold text-xs">
                        {booking.customer_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white">{booking.customer_name}</span>
                        {booking.service_name && (
                          <span className="ml-2 text-xs text-purple-400 font-semibold">{booking.service_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>📅 {new Date(booking.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                      <span>⏰ {booking.time}</span>
                      {booking.customer_phone && <span>📞 {booking.customer_phone}</span>}
                      {booking.customer_email && <span>📧 {booking.customer_email}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUS_COLORS[booking.status] || "bg-slate-500/10 text-slate-400"}`}>
                      {STATUS_ICONS[booking.status] || ""} {booking.status}
                    </span>
                    <select
                      value={booking.status}
                      onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded text-xs px-2 py-1 text-white"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* === NEW BOOKING FORM === */}
      {showBookingForm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-6 relative">
            <button onClick={() => setShowBookingForm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl">✕</button>
            <h3 className="text-xl font-bold text-white">New Booking</h3>
            <form onSubmit={handleCreateBooking} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Customer Name *</label>
                <input
                  type="text" required value={bookingForm.customerName}
                  onChange={(e) => setBookingForm((f) => ({ ...f, customerName: e.target.value }))}
                  placeholder="John Doe"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Email</label>
                  <input
                    type="email" value={bookingForm.customerEmail}
                    onChange={(e) => setBookingForm((f) => ({ ...f, customerEmail: e.target.value }))}
                    placeholder="john@email.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Phone</label>
                  <input
                    type="tel" value={bookingForm.customerPhone}
                    onChange={(e) => setBookingForm((f) => ({ ...f, customerPhone: e.target.value }))}
                    placeholder="+1 555-1234"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Service</label>
                <select
                  value={bookingForm.serviceId}
                  onChange={(e) => setBookingForm((f) => ({ ...f, serviceId: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                >
                  <option value="">Select a service...</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} (${s.price})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Date *</label>
                  <input
                    type="date" required value={bookingForm.date}
                    onChange={(e) => setBookingForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Time *</label>
                  <input
                    type="time" required value={bookingForm.time}
                    onChange={(e) => setBookingForm((f) => ({ ...f, time: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-sm"
                  />
                </div>
              </div>
              <button type="submit" disabled={savingBooking}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-lg transition disabled:opacity-50 text-sm"
              >
                {savingBooking ? "Creating..." : "Create Booking"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}