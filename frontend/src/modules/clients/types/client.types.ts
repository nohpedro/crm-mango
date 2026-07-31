export interface Client {
  id: string
  name: string
  tax_id: string
  department: string
  city_zone: string
  whatsapp: string
  client_type: string
  price_level: { id: string; name: string; code: string }
  business_activity: string
  observations: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ClientWriteRequest {
  name: string
  tax_id: string
  department: string
  city_zone: string
  whatsapp: string
  client_type: string
  price_level: string
  business_activity: string
  observations: string
  is_active: boolean
}

export interface ClientType {
  id: string
  name: string
  is_active: boolean
}
