/* ═══════════════════════════════════════════════════════
   state.js — Estado compartido entre todos los módulos
   ═══════════════════════════════════════════════════════ */
'use strict';

// Supabase client & connection
export let supa = null;
export let IS_CONNECTED = false;
export function setSupa(client) { supa = client; }
export function setConnected(val) { IS_CONNECTED = val; }

// Auth
export let currentUser = null;
export function setCurrentUser(u) { currentUser = u; }

// Plantel cache
export let allPlayers = [];
export function setAllPlayers(arr) { allPlayers = arr; }

// Convocatoria
export let selectedPlayerIds = new Set();
export function setSelectedPlayerIds(s) { selectedPlayerIds = s; }

// Modal state
export let editingEventId = null;
export function setEditingEventId(id) { editingEventId = id; }
export let attStatuses = {};
export function setAttStatuses(obj) { attStatuses = obj; }
export let cachedBirthdays = [];
export function setCachedBirthdays(arr) { cachedBirthdays = arr; }

// Plantel filter
export let currentRosterFilter = 'all';
export function setCurrentRosterFilter(v) { currentRosterFilter = v; }

// Tesorera
export let editingTreasEventId = null;
export function setEditingTreasEventId(id) { editingTreasEventId = id; }

// Auth flow
export let loginFoundUser = null;
export function setLoginFoundUser(u) { loginFoundUser = u; }
