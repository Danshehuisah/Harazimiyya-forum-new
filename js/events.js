// ============================================
// HARAZIMIYYA FORUM - EVENTS DASHBOARD
// WITH LOCATION CAPTURE FEATURE
// ============================================

// Global variables
let currentUser = null;
let currentProfile = null;
let isAdmin = false;
let allEvents = [];
let currentTab = 'upcoming';
let selectedEventId = null;
let previewMap = null;
let previewMarker = null;

// DOM Elements
const eventsContainer = document.getElementById("eventsContainer");
const createEventBtn = document.getElementById("createEventBtn");
const tabs = document.querySelectorAll(".tab");
const logoutBtn = document.getElementById("logoutBtn");

// Sidebar elements
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const openSidebar = document.getElementById("openSidebar");
const closeSidebar = document.getElementById("closeSidebar");

// ================= SIDEBAR TOGGLE =================
if (openSidebar) {
  openSidebar.onclick = () => {
    sidebar.classList.add("active");
    overlay.classList.add("active");
  };
}

if (closeSidebar) {
  closeSidebar.onclick = () => {
    sidebar.classList.remove("active");
    overlay.classList.remove("active");
  };
}

if (overlay) {
  overlay.onclick = () => {
    sidebar.classList.remove("active");
    overlay.classList.remove("active");
  };
}

// ================= NOTIFICATION FUNCTION =================
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// ================= GEOLOCATION FUNCTION =================
function getCurrentLocation() {
  const getLocationBtn = document.getElementById('getLocationBtn');
  
  if (!navigator.geolocation) {
    showNotification('Your browser does not support geolocation', 'error');
    return;
  }
  
  if (getLocationBtn) {
    getLocationBtn.disabled = true;
    getLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting location...';
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude.toFixed(6);
      const lng = position.coords.longitude.toFixed(6);
      
      const latInput = document.getElementById('eventLat');
      const lngInput = document.getElementById('eventLng');
      
      if (latInput) latInput.value = lat;
      if (lngInput) lngInput.value = lng;
      
      showNotification(`Location captured! Lat: ${lat}, Lng: ${lng}`, 'success');
      
      // Show mini map preview
      showMiniMapPreview(lat, lng);
      
      if (getLocationBtn) {
        getLocationBtn.disabled = false;
        getLocationBtn.innerHTML = '<i class="fas fa-location-dot"></i> 📍 Get My Current Location';
      }
    },
    (error) => {
      let errorMessage = 'Unable to get your location. ';
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMessage += 'Please enable location access in your browser settings.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage += 'Location information is unavailable. Make sure GPS is enabled.';
          break;
        case error.TIMEOUT:
          errorMessage += 'Location request timed out. Please try again.';
          break;
        default:
          errorMessage += 'Please check your device location settings.';
      }
      showNotification(errorMessage, 'error');
      if (getLocationBtn) {
        getLocationBtn.disabled = false;
        getLocationBtn.innerHTML = '<i class="fas fa-location-dot"></i> 📍 Get My Current Location';
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// ================= SHOW MINI MAP PREVIEW =================
function showMiniMapPreview(lat, lng) {
  const previewContainer = document.getElementById('eventMapPreview');
  if (!previewContainer) return;
  
  // Check if Leaflet is available
  if (typeof L === 'undefined') {
    console.warn("Leaflet not loaded for preview");
    return;
  }
  
  previewContainer.style.display = 'block';
  
  if (previewMap) {
    previewMap.remove();
  }
  
  previewMap = L.map('eventMapPreview').setView([parseFloat(lat), parseFloat(lng)], 15);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(previewMap);
  
  if (previewMarker) {
    previewMap.removeLayer(previewMarker);
  }
  
  previewMarker = L.marker([parseFloat(lat), parseFloat(lng)]).addTo(previewMap);
}

// ================= CREATE MODALS =================
function createModals() {
  // Create Event Modal
  const modalHTML = `
    <div id="eventModal" class="modal hidden">
      <div class="modal-content">
        <h2 id="modalTitle">Create New Event</h2>
        
        <div class="form-group">
          <label><i class="fas fa-heading"></i> Event Title *</label>
          <input type="text" id="eventTitle" placeholder="e.g., Weekly Moulud at Kano" required>
        </div>
        
        <div class="form-group">
          <label><i class="fas fa-align-left"></i> Description</label>
          <textarea id="eventDescription" placeholder="Event details, program schedule..."></textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label><i class="fas fa-calendar"></i> Date *</label>
            <input type="date" id="eventDate" required>
          </div>
          <div class="form-group" style="flex: 0.7;">
            <label><i class="fas fa-clock"></i> Time</label>
            <input type="number" id="eventHour" placeholder="HH" min="1" max="12" style="width: 70px; display: inline-block; margin-right: 5px;">
            <span style="color: var(--text);">:</span>
            <input type="number" id="eventMinute" placeholder="MM" min="0" max="59" style="width: 70px; display: inline-block; margin: 0 5px;">
            <select id="eventAmPm" style="width: 70px; display: inline-block;">
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label><i class="fas fa-map-pin"></i> Location *</label>
            <input type="text" id="eventLocation" placeholder="Venue name" required>
          </div>
          <div class="form-group">
            <label><i class="fas fa-map-marker-alt"></i> State</label>
            <input type="text" id="eventState" placeholder="e.g., Kano">
          </div>
        </div>
        
        <div class="form-group">
          <label><i class="fas fa-address-card"></i> Address</label>
          <input type="text" id="eventAddress" placeholder="Full address">
        </div>
        
        <!-- Phone Number Field -->
        <div class="form-group">
          <label><i class="fas fa-phone"></i> Contact Phone Number</label>
          <input type="tel" id="eventPhone" placeholder="e.g., +234 123 456 7890">
          <small style="color: var(--text-muted); display: block; margin-top: 5px;">Attendees can reach you at this number</small>
        </div>
        
        <!-- LOCATION CAPTURE SECTION (NEW) -->
        <div class="form-group">
          <label><i class="fas fa-map-marker-alt"></i> Event Venue Coordinates</label>
          <div class="coord-input-group">
            <button type="button" id="getLocationBtn" class="location-btn">
              <i class="fas fa-location-dot"></i> 📍 Get My Current Location
            </button>
            <div class="coord-row">
              <input type="text" id="eventLat" placeholder="Latitude" readonly style="background: #f5f5f5;">
              <input type="text" id="eventLng" placeholder="Longitude" readonly style="background: #f5f5f5;">
            </div>
          </div>
          <small class="coord-help">
            <i class="fas fa-info-circle"></i> 
            Stand exactly at the event venue and click the button above to capture precise GPS coordinates.
            This helps attendees find the exact location.
          </small>
        </div>
        
        <div id="eventMapPreview" style="height: 200px; border-radius: 8px; margin-bottom: 15px; display: none; border: 1px solid var(--border);"></div>
        
        <div class="form-row">
          <div class="form-group">
            <label><i class="fas fa-users"></i> Max Attendees</label>
            <input type="number" id="eventMaxAttendees" placeholder="Optional" min="1">
          </div>
          <div class="form-group">
            <label><i class="fas fa-tag"></i> Status</label>
            <select id="eventStatus">
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        
        <div class="modal-actions">
          <button id="saveEventBtn" class="primary-btn"><i class="fas fa-save"></i> Save Event</button>
          <button id="closeModalBtn" class="ghost-btn"><i class="fas fa-times"></i> Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  // Delete Modal
  const deleteModalHTML = `
    <div id="deleteModal" class="modal hidden">
      <div class="modal-content delete-modal">
        <i class="fas fa-exclamation-triangle" style="font-size: 48px;"></i>
        <h3>Delete Event?</h3>
        <p>This action cannot be undone. All RSVPs will be lost.</p>
        <div class="modal-actions">
          <button id="confirmDeleteBtn" class="primary-btn" style="background: #dc3545;">Delete</button>
          <button id="cancelDeleteBtn" class="ghost-btn">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  // Attendees Modal
  const attendeesModalHTML = `
    <div id="attendeesModal" class="modal hidden">
      <div class="modal-content">
        <h2><i class="fas fa-users"></i> Event Attendees</h2>
        <div id="attendeesList" class="attendees-list"></div>
        <div class="modal-actions">
          <button id="closeAttendeesBtn" class="ghost-btn">Close</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  document.body.insertAdjacentHTML('beforeend', deleteModalHTML);
  document.body.insertAdjacentHTML('beforeend', attendeesModalHTML);
  
  // Modal close buttons
  const closeModalBtn = document.getElementById('closeModalBtn');
  if (closeModalBtn) {
    closeModalBtn.onclick = () => {
      const modal = document.getElementById('eventModal');
      if (modal) modal.classList.add('hidden');
      if (previewMap) {
        previewMap.remove();
        previewMap = null;
      }
    };
  }
  
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  if (cancelDeleteBtn) {
    cancelDeleteBtn.onclick = () => {
      const modal = document.getElementById('deleteModal');
      if (modal) modal.classList.add('hidden');
      selectedEventId = null;
    };
  }
  
  const closeAttendeesBtn = document.getElementById('closeAttendeesBtn');
  if (closeAttendeesBtn) {
    closeAttendeesBtn.onclick = () => {
      const modal = document.getElementById('attendeesModal');
      if (modal) modal.classList.add('hidden');
    };
  }
  
  // Save event button
  const saveEventBtn = document.getElementById('saveEventBtn');
  if (saveEventBtn) {
    saveEventBtn.onclick = saveEvent;
  }
  
  // Confirm delete button
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.onclick = confirmDelete;
  }
  
  // Get location button
  const getLocationBtn = document.getElementById('getLocationBtn');
  if (getLocationBtn) {
    getLocationBtn.onclick = getCurrentLocation;
  }
  
  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    const eventModal = document.getElementById('eventModal');
    const deleteModal = document.getElementById('deleteModal');
    const attendeesModal = document.getElementById('attendeesModal');
    
    if (e.target === eventModal) {
      eventModal.classList.add('hidden');
      if (previewMap) {
        previewMap.remove();
        previewMap = null;
      }
    }
    if (e.target === deleteModal) deleteModal.classList.add('hidden');
    if (e.target === attendeesModal) attendeesModal.classList.add('hidden');
  });
}

// ================= INITIALIZATION =================
async function initEvents() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      window.location.href = "../index.html";
      return;
    }

    currentUser = user;
    console.log("Current user:", user.email);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Profile error:", profileError);
      return;
    }

    currentProfile = profile;
    isAdmin = (profile.role === 'admin' || profile.role === 'small_admin');
    console.log("Is admin or small admin:", isAdmin);

    // Create modals
    createModals();

    // Show create button only for admin/small admin
    if (createEventBtn) {
      if (isAdmin) {
        createEventBtn.style.display = 'flex';
        createEventBtn.onclick = openCreateModal;
      } else {
        createEventBtn.style.display = 'none';
      }
    }

    // Setup tab listeners
    setupTabs();

    // Load events
    await loadEvents();

  } catch (err) {
    console.error("Initialization error:", err);
  }
}

// ================= SETUP TABS =================
function setupTabs() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      filterAndDisplayEvents();
    });
  });
}

// ================= LOAD EVENTS =================
async function loadEvents() {
  showSkeleton();
  
  try {
    const { data: eventsData, error: eventsError } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: true });

    if (eventsError) throw eventsError;

    console.log("Events loaded:", eventsData);

    if (!eventsData || eventsData.length === 0) {
      eventsContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-calendar-plus"></i>
          <h3>No Events Yet</h3>
          <p>${isAdmin ? 'Click "Create Event" to add your first event' : 'Check back later for upcoming events'}</p>
        </div>
      `;
      return;
    }

    // Get host profiles
    const hostIds = [...new Set(eventsData.map(e => e.host_id))];
    
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", hostIds);

    if (profilesError) console.error("Profiles query error:", profilesError);

    const hostMap = {};
    if (profiles) {
      profiles.forEach(p => {
        hostMap[p.id] = p;
      });
    }

    // Get attendance counts
    const eventIds = eventsData.map(e => e.id);
    
    const { data: counts, error: countsError } = await supabase
      .from("event_attendees")
      .select("event_id, status")
      .in("event_id", eventIds);

    if (countsError) console.error("Counts query error:", countsError);

    const attendeeCounts = {};
    if (counts) {
      counts.forEach(a => {
        if (!attendeeCounts[a.event_id]) {
          attendeeCounts[a.event_id] = { attending: 0, maybe: 0 };
        }
        if (a.status === 'attending') attendeeCounts[a.event_id].attending++;
        if (a.status === 'maybe') attendeeCounts[a.event_id].maybe++;
      });
    }

    allEvents = eventsData.map(event => ({
      ...event,
      host: hostMap[event.host_id] || { full_name: 'Unknown', email: '' },
      attendees: [{ count: attendeeCounts[event.id]?.attending || 0 }]
    }));

    // Get user's attendance status
    if (currentUser) {
      const { data: attendance } = await supabase
        .from("event_attendees")
        .select("event_id, status")
        .eq("user_id", currentUser.id);
      
      if (attendance) {
        window.userAttendance = {};
        attendance.forEach(a => {
          window.userAttendance[a.event_id] = a.status;
        });
      }
    }

    filterAndDisplayEvents();

  } catch (err) {
    console.error("Error loading events:", err);
    eventsContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <h3>Error Loading Events</h3>
        <p>Please try again later</p>
        <small>${err.message || 'Unknown error'}</small>
      </div>
    `;
  }
}

// ================= FILTER AND DISPLAY EVENTS =================
function filterAndDisplayEvents() {
  let filtered = [...allEvents];
  const now = new Date();
  
  filtered = filtered.filter(event => {
    const eventDate = new Date(event.date);
    
    switch(currentTab) {
      case 'upcoming':
        return eventDate >= now && event.status !== 'cancelled' && event.status !== 'completed';
      case 'past':
        return eventDate < now || event.status === 'completed' || event.status === 'cancelled';
      case 'mine':
        return event.host_id === currentUser.id;
      default:
        return true;
    }
  });
  
  displayEvents(filtered);
}

// ================= FORMAT TIME WITH AM/PM =================
function formatTimeWithAmPm(timeString) {
  if (!timeString) return '';
  
  try {
    const timeParts = timeString.split(':');
    if (timeParts.length >= 2) {
      const hours = parseInt(timeParts[0]);
      const minutes = timeParts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12;
      return `at ${hours12}:${minutes} ${ampm}`;
    }
    return `at ${timeString}`;
  } catch (e) {
    return `at ${timeString}`;
  }
}

// ================= CONVERT 12-HOUR TO 24-HOUR =================
function convertTo24Hour(hour, minute, ampm) {
  let hours = parseInt(hour);
  if (ampm === 'PM' && hours !== 12) {
    hours += 12;
  } else if (ampm === 'AM' && hours === 12) {
    hours = 0;
  }
  return `${hours.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

// ================= OPEN CREATE MODAL =================
function openCreateModal() {
  const modalTitle = document.getElementById('modalTitle');
  const eventTitle = document.getElementById('eventTitle');
  const eventDescription = document.getElementById('eventDescription');
  const eventDate = document.getElementById('eventDate');
  const eventHour = document.getElementById('eventHour');
  const eventMinute = document.getElementById('eventMinute');
  const eventAmPm = document.getElementById('eventAmPm');
  const eventLocation = document.getElementById('eventLocation');
  const eventState = document.getElementById('eventState');
  const eventAddress = document.getElementById('eventAddress');
  const eventPhone = document.getElementById('eventPhone');
  const eventLat = document.getElementById('eventLat');
  const eventLng = document.getElementById('eventLng');
  const eventMaxAttendees = document.getElementById('eventMaxAttendees');
  const eventStatus = document.getElementById('eventStatus');
  
  if (modalTitle) modalTitle.textContent = 'Create New Event';
  if (eventTitle) eventTitle.value = '';
  if (eventDescription) eventDescription.value = '';
  if (eventDate) eventDate.value = '';
  if (eventHour) eventHour.value = '';
  if (eventMinute) eventMinute.value = '';
  if (eventAmPm) eventAmPm.value = 'AM';
  if (eventLocation) eventLocation.value = '';
  if (eventState) eventState.value = '';
  if (eventAddress) eventAddress.value = '';
  if (eventPhone) eventPhone.value = '';
  if (eventLat) eventLat.value = '';
  if (eventLng) eventLng.value = '';
  if (eventMaxAttendees) eventMaxAttendees.value = '';
  if (eventStatus) eventStatus.value = 'upcoming';
  
  // Hide map preview
  const previewContainer = document.getElementById('eventMapPreview');
  if (previewContainer) previewContainer.style.display = 'none';
  if (previewMap) {
    previewMap.remove();
    previewMap = null;
  }
  
  selectedEventId = null;
  const modal = document.getElementById('eventModal');
  if (modal) modal.classList.remove('hidden');
}

// ================= EDIT EVENT =================
window.editEvent = function(eventId) {
  const event = allEvents.find(e => e.id === eventId);
  if (!event) return;
  
  const modalTitle = document.getElementById('modalTitle');
  const eventTitle = document.getElementById('eventTitle');
  const eventDescription = document.getElementById('eventDescription');
  const eventDate = document.getElementById('eventDate');
  const eventLocation = document.getElementById('eventLocation');
  const eventState = document.getElementById('eventState');
  const eventAddress = document.getElementById('eventAddress');
  const eventPhone = document.getElementById('eventPhone');
  const eventLat = document.getElementById('eventLat');
  const eventLng = document.getElementById('eventLng');
  const eventMaxAttendees = document.getElementById('eventMaxAttendees');
  const eventStatus = document.getElementById('eventStatus');
  
  if (modalTitle) modalTitle.textContent = 'Edit Event';
  if (eventTitle) eventTitle.value = event.title || '';
  if (eventDescription) eventDescription.value = event.description || '';
  if (eventDate) eventDate.value = event.date || '';
  if (eventLocation) eventLocation.value = event.location || '';
  if (eventState) eventState.value = event.state || '';
  if (eventAddress) eventAddress.value = event.address || '';
  if (eventPhone) eventPhone.value = event.phone || '';
  if (eventLat) eventLat.value = event.latitude || '';
  if (eventLng) eventLng.value = event.longitude || '';
  if (eventMaxAttendees) eventMaxAttendees.value = event.max_attendees || '';
  if (eventStatus) eventStatus.value = event.status || 'upcoming';
  
  // Parse time
  if (event.time && event.time.includes(':')) {
    const timeParts = event.time.split(':');
    const hours24 = parseInt(timeParts[0]);
    const minutes = timeParts[1];
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;
    
    const eventHour = document.getElementById('eventHour');
    const eventMinute = document.getElementById('eventMinute');
    const eventAmPm = document.getElementById('eventAmPm');
    
    if (eventHour) eventHour.value = hours12;
    if (eventMinute) eventMinute.value = minutes;
    if (eventAmPm) eventAmPm.value = ampm;
  }
  
  // Show map preview if coordinates exist
  if (event.latitude && event.longitude) {
    showMiniMapPreview(event.latitude, event.longitude);
  } else {
    const previewContainer = document.getElementById('eventMapPreview');
    if (previewContainer) previewContainer.style.display = 'none';
  }
  
  selectedEventId = eventId;
  const modal = document.getElementById('eventModal');
  if (modal) modal.classList.remove('hidden');
};

// ================= SAVE EVENT =================
async function saveEvent() {
  const title = document.getElementById('eventTitle')?.value.trim();
  const date = document.getElementById('eventDate')?.value;
  const location = document.getElementById('eventLocation')?.value.trim();
  
  if (!title || !date || !location) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }
  
  const hour = document.getElementById('eventHour')?.value;
  const minute = document.getElementById('eventMinute')?.value;
  const ampm = document.getElementById('eventAmPm')?.value;
  
  let time = null;
  if (hour && minute) {
    time = convertTo24Hour(hour, minute, ampm);
  }
  
  const latitude = document.getElementById('eventLat')?.value;
  const longitude = document.getElementById('eventLng')?.value;
  
  const eventData = {
    title,
    description: document.getElementById('eventDescription')?.value.trim() || null,
    date,
    time: time,
    location,
    state: document.getElementById('eventState')?.value.trim() || null,
    address: document.getElementById('eventAddress')?.value.trim() || null,
    phone: document.getElementById('eventPhone')?.value.trim() || null,
    latitude: latitude ? parseFloat(latitude) : null,
    longitude: longitude ? parseFloat(longitude) : null,
    max_attendees: document.getElementById('eventMaxAttendees')?.value ? 
                   parseInt(document.getElementById('eventMaxAttendees').value) : null,
    status: document.getElementById('eventStatus')?.value || 'upcoming',
    host_id: currentUser.id,
    host_name: currentProfile.full_name
  };
  
  try {
    let error;
    
    if (selectedEventId) {
      ({ error } = await supabase
        .from('events')
        .update(eventData)
        .eq('id', selectedEventId));
    } else {
      ({ error } = await supabase
        .from('events')
        .insert([eventData]));
    }
    
    if (error) throw error;
    
    const modal = document.getElementById('eventModal');
    if (modal) modal.classList.add('hidden');
    
    showNotification(selectedEventId ? 'Event updated successfully' : 'Event created successfully');
    
    await enforceEventLimit();
    await loadEvents();
    
  } catch (err) {
    console.error("Error saving event:", err);
    showNotification('Error saving event: ' + (err.message || 'Unknown error'), 'error');
  }
}

// ================= CREATE EVENT CARD =================
function createEventCard(event) {
  const card = document.createElement("div");
  card.className = `event-card ${event.status || 'upcoming'}`;
  
  const eventDate = new Date(event.date);
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  const timeDisplay = formatTimeWithAmPm(event.time);
  
  const isHost = event.host_id === currentUser.id;
  const userAttendStatus = window.userAttendance?.[event.id];
  const attendeeCount = event.attendees?.[0]?.count || 0;
  
  let attendButtonClass = 'attend-btn';
  let attendButtonText = '<i class="fas fa-calendar-check"></i> Attend';
  
  if (userAttendStatus === 'attending') {
    attendButtonClass += ' attending';
    attendButtonText = '<i class="fas fa-check"></i> Attending';
  } else if (userAttendStatus === 'maybe') {
    attendButtonClass += ' maybe';
    attendButtonText = '<i class="fas fa-clock"></i> Maybe';
  }
  
  // Check if event has coordinates
  const hasCoordinates = event.latitude && event.longitude;
  const coordBadge = hasCoordinates ? '<span class="coord-badge"><i class="fas fa-map-marker-alt"></i> Location pinned</span>' : '';
  
  card.innerHTML = `
    <div class="event-badge ${event.status || 'upcoming'}">${event.status || 'upcoming'}</div>
    <h3 class="event-title">${escapeHtml(event.title)} ${coordBadge}</h3>
    
    <div class="event-details">
      <div class="event-detail">
        <i class="fas fa-calendar"></i>
        <span class="label">Date:</span>
        <span class="value">${formattedDate} ${timeDisplay}</span>
      </div>
      
      <div class="event-detail">
        <i class="fas fa-map-pin"></i>
        <span class="label">Location:</span>
        <span class="value">${escapeHtml(event.location)}</span>
      </div>
      
      ${event.state ? `
        <div class="event-detail">
          <i class="fas fa-map-marker-alt"></i>
          <span class="label">State:</span>
          <span class="value">${escapeHtml(event.state)}</span>
        </div>
      ` : ''}
      
      ${event.phone ? `
        <div class="event-detail">
          <i class="fas fa-phone"></i>
          <span class="label">Contact:</span>
          <span class="value">
            <a href="tel:${event.phone}" style="color: var(--primary); text-decoration: none;">
              ${escapeHtml(event.phone)}
            </a>
          </span>
        </div>
      ` : ''}
    </div>
    
    ${event.description ? `
      <div class="event-description">
        <i class="fas fa-align-left"></i>
        <p>${escapeHtml(event.description)}</p>
      </div>
    ` : ''}
    
    <div class="event-host">
      <i class="fas fa-user"></i>
      <span>Hosted by <strong>${escapeHtml(event.host?.full_name || 'Unknown')}</strong></span>
    </div>
    
    <div class="event-stats">
      <div class="event-stat">
        <i class="fas fa-users"></i>
        <strong>${attendeeCount}</strong> attending
      </div>
      ${event.max_attendees ? `
        <div class="event-stat">
          <i class="fas fa-user-plus"></i>
          <strong>${event.max_attendees - attendeeCount}</strong> spots left
        </div>
      ` : ''}
    </div>
    
    <div class="event-actions">
      <button class="${attendButtonClass}" onclick="toggleAttendance('${event.id}')">
        ${attendButtonText}
      </button>
      <button class="view-btn" onclick="viewEventDetails('${event.id}')">
        <i class="fas fa-eye"></i> Details
      </button>
      ${hasCoordinates ? `
        <button class="view-btn view-on-map-btn" onclick="viewOnMap('${event.latitude}', '${event.longitude}', '${escapeHtml(event.title)}')">
          <i class="fas fa-map-marked-alt"></i> Map
        </button>
      ` : ''}
    </div>
    
    ${isAdmin ? `
      <div class="admin-actions">
        <button class="admin-btn edit-btn" onclick="editEvent('${event.id}')">
          <i class="fas fa-edit"></i>
        </button>
        <button class="admin-btn delete-btn" onclick="openDeleteModal('${event.id}')">
          <i class="fas fa-trash"></i>
        </button>
        <button class="admin-btn view-btn" onclick="viewAttendees('${event.id}')">
          <i class="fas fa-users"></i>
        </button>
      </div>
    ` : isHost ? `
      <div class="admin-actions">
        <button class="admin-btn view-btn" onclick="viewAttendees('${event.id}')">
          <i class="fas fa-users"></i> View RSVPs
        </button>
      </div>
    ` : ''}
  `;
  
  return card;
}

// ================= VIEW ON MAP =================
window.viewOnMap = function(lat, lng, title) {
  window.location.href = `map.html?lat=${lat}&lng=${lng}&title=${encodeURIComponent(title)}`;
};

// ================= TOGGLE ATTENDANCE =================
window.toggleAttendance = async function(eventId) {
  if (!currentUser) return;
  
  const currentStatus = window.userAttendance?.[eventId];
  let newStatus;
  
  if (!currentStatus) {
    newStatus = 'attending';
  } else if (currentStatus === 'attending') {
    newStatus = 'maybe';
  } else if (currentStatus === 'maybe') {
    newStatus = null;
  }
  
  try {
    if (newStatus === null) {
      const { error } = await supabase
        .from('event_attendees')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', currentUser.id);
      
      if (error) throw error;
      
      delete window.userAttendance[eventId];
      showNotification('You are no longer attending this event');
      
    } else {
      const { error } = await supabase
        .from('event_attendees')
        .upsert({
          event_id: eventId,
          user_id: currentUser.id,
          status: newStatus
        });
      
      if (error) throw error;
      
      window.userAttendance[eventId] = newStatus;
      showNotification(newStatus === 'attending' ? 'You are now attending!' : 'Status updated to Maybe');
    }
    
    await updateEventAttendeeCount(eventId);
    
  } catch (err) {
    console.error("Error toggling attendance:", err);
    showNotification('Error updating attendance', 'error');
  }
};

// ================= UPDATE EVENT ATTENDEE COUNT =================
async function updateEventAttendeeCount(eventId) {
  try {
    const { count, error } = await supabase
      .from('event_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'attending');
    
    if (error) throw error;
    
    await supabase
      .from('events')
      .update({ current_attendees: count })
      .eq('id', eventId);
    
    await loadEvents();
    
  } catch (err) {
    console.error("Error updating attendee count:", err);
  }
}

// ================= ENFORCE EVENT LIMIT =================
async function enforceEventLimit() {
  try {
    const { count, error: countError } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;
    
    console.log(`Current event count: ${count}, limit: 11`);
    
    if (count > 11) {
      const { data: oldestEvents, error: fetchError } = await supabase
        .from('events')
        .select('id, title, date')
        .order('date', { ascending: true })
        .limit(count - 11);
      
      if (fetchError) throw fetchError;
      
      if (oldestEvents && oldestEvents.length > 0) {
        const idsToDelete = oldestEvents.map(e => e.id);
        console.log(`Deleting ${idsToDelete.length} oldest events to maintain limit of 11`);
        
        const { error: attendeesError } = await supabase
          .from('event_attendees')
          .delete()
          .in('event_id', idsToDelete);
        
        if (attendeesError) throw attendeesError;
        
        const { error: deleteError } = await supabase
          .from('events')
          .delete()
          .in('id', idsToDelete);
        
        if (deleteError) throw deleteError;
        
        showNotification(`Cleaned up ${idsToDelete.length} old event(s) to maintain 11 event limit`, 'warning');
      }
    }
  } catch (err) {
    console.error("Error enforcing event limit:", err);
  }
}

// ================= VIEW EVENT DETAILS =================
window.viewEventDetails = function(eventId) {
  const event = allEvents.find(e => e.id === eventId);
  if (!event) return;
  
  const eventDate = new Date(event.date);
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  let timeDisplay = 'Not specified';
  if (event.time) {
    try {
      const timeParts = event.time.split(':');
      if (timeParts.length >= 2) {
        const hours = parseInt(timeParts[0]);
        const minutes = timeParts[1];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        timeDisplay = `${hours12}:${minutes} ${ampm}`;
      } else {
        timeDisplay = event.time;
      }
    } catch (e) {
      timeDisplay = event.time;
    }
  }
  
  let coordinatesText = '';
  if (event.latitude && event.longitude) {
    coordinatesText = `\n📍 Coordinates: ${event.latitude}, ${event.longitude}`;
  }
  
  alert(`
📅 EVENT DETAILS
━━━━━━━━━━━━━━━━
Title: ${event.title}
Date: ${formattedDate}
Time: ${timeDisplay}
Location: ${event.location}
${event.address ? `Address: ${event.address}` : ''}
${event.state ? `State: ${event.state}` : ''}
${event.phone ? `📞 Contact: ${event.phone}` : ''}
${coordinatesText}
Host: ${event.host?.full_name || 'Unknown'}

📝 Description:
${event.description || 'No description provided'}

👥 Attendees: ${event.attendees?.[0]?.count || 0} attending
  `);
};

// ================= VIEW ATTENDEES =================
window.viewAttendees = async function(eventId) {
  try {
    const { data, error } = await supabase
      .from('event_attendees')
      .select(`
        *,
        user:profiles!user_id(full_name, email, state)
      `)
      .eq('event_id', eventId)
      .order('created_at');
    
    if (error) throw error;
    
    const attendeesList = document.getElementById('attendeesList');
    if (!attendeesList) return;
    
    if (!data || data.length === 0) {
      attendeesList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-users"></i>
          <p>No attendees yet</p>
        </div>
      `;
    } else {
      let html = '';
      data.forEach(a => {
        html += `
          <div class="attendee-item">
            <div class="attendee-avatar">
              <i class="fas fa-user"></i>
            </div>
            <div class="attendee-info">
              <h4>${escapeHtml(a.user?.full_name || 'Unknown')}</h4>
              <p>${a.user?.email || ''} ${a.user?.state ? '• ' + escapeHtml(a.user.state) : ''}</p>
            </div>
            <span class="attendee-status ${a.status}">${a.status}</span>
          </div>
        `;
      });
      attendeesList.innerHTML = html;
    }
    
    const modal = document.getElementById('attendeesModal');
    if (modal) modal.classList.remove('hidden');
    
  } catch (err) {
    console.error("Error loading attendees:", err);
    showNotification('Error loading attendees', 'error');
  }
};

// ================= OPEN DELETE MODAL =================
window.openDeleteModal = function(eventId) {
  selectedEventId = eventId;
  const modal = document.getElementById('deleteModal');
  if (modal) modal.classList.remove('hidden');
};

// ================= CONFIRM DELETE =================
async function confirmDelete() {
  if (!selectedEventId) return;
  
  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', selectedEventId);
    
    if (error) throw error;
    
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.add('hidden');
    
    showNotification('Event deleted successfully');
    await loadEvents();
    
  } catch (err) {
    console.error("Error deleting event:", err);
    showNotification('Error deleting event', 'error');
  }
}

// ================= DISPLAY EVENTS =================
function displayEvents(events) {
  eventsContainer.innerHTML = "";

  if (!events || events.length === 0) {
    eventsContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-calendar-times"></i>
        <h3>No Events Found</h3>
        <p>${currentTab === 'upcoming' ? 'Check back later for upcoming events' : 
            currentTab === 'past' ? 'No past events to show' : 
            isAdmin ? 'Click "Create Event" to add your first event' : 'You haven\'t created any events'}</p>
      </div>
    `;
    return;
  }

  events.forEach(event => {
    const card = createEventCard(event);
    eventsContainer.appendChild(card);
  });
}

// ================= SHOW SKELETON =================
function showSkeleton() {
  eventsContainer.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "skeleton";
    eventsContainer.appendChild(skeleton);
  }
}

// ================= ESCAPE HTML =================
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// ================= LOGOUT =================
if (logoutBtn) {
  logoutBtn.onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "../index.html";
  };
}

// ================= START APPLICATION =================
initEvents();