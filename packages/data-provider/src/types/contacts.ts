export interface IContactAttribute {
  key: string;
  value: string;
}

export interface IContact {
  _id?: string;
  userId: string;
  name: string;
  company?: string;
  role?: string;
  email?: string;
  notes?: string;
  attributes: IContactAttribute[];   
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IContactCreatePayload {
  name: string;
  company?: string;
  role?: string;
  email?: string;
  notes?: string;
  attributes?: IContactAttribute[];
}

export interface IContactSearchParams {
  query?: string;         
  company?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export interface IContactsListResponse {
  contacts: IContact[];
  total: number;
  page: number;
  pages: number;
}