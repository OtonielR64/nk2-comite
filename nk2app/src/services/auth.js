import { api } from './api'

const TOKEN_KEY = 'nk2_token'
const ROLE_KEY  = 'nk2_role'
const USER_KEY  = 'nk2_user'

export async function login(username, password) {
  const data = await api.login({ username, password })
  localStorage.setItem(TOKEN_KEY, data.token)
  localStorage.setItem(ROLE_KEY,  data.rol)
  localStorage.setItem(USER_KEY,  data.username)
  return data.rol
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ROLE_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getRole() {
  return localStorage.getItem(ROLE_KEY)
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUsername() {
  return localStorage.getItem(USER_KEY)
}

export function isAdmin() {
  const r = getRole()
  return r === 'admin' || r === 'superadmin'
}

export function isLoggedIn() {
  return !!getToken()
}
