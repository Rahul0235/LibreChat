import { atom } from 'recoil';

export interface IContact {
  _id?: string;
  name: string;
  company?: string;
  role?: string;
  email?: string;
  notes?: string;
  attributes?: { key: string; value: string }[];
}

export const selectedContactAtom = atom<IContact | null>({
  key: 'selectedContact',
  default: null,
});