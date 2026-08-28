import { FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api/adminApi'
import type { AdminComparsa, AdminItem, AdminNight, AdminUser } from '../../api/adminApi'
import { ApiClientError } from '../../api/apiClient'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import type { Role } from '../../types/domain'

interface UserForm { nombre: string; dni: string; email: string; role: Role; activo: boolean }
interface NightForm { nombre: string; fecha: string }
interface ComparsaForm { nombre: string; nocheId: string; activo: boolean }
interface ItemForm { nombre: string; parentItemId: string; orden: string; activo: boolean }

type ConfirmAction =
  | { type: 'updateUser'; id: string; label: string; body: Partial<Omit<AdminUser, 'id' | 'createdAt' | 'updatedAt'>> }
  | { type: 'deleteUser'; id: string; label: string }
  | { type: 'updateNight'; id: number; label: string; body: Partial<Pick<AdminNight, 'nombre' | 'fecha'>> }
  | { type: 'deleteNight'; id: number; label: string }
  | { type: 'openNight'; id: number; label: string }
  | { type: 'closeNight'; id: number; label: string }
  | { type: 'updateComparsa'; id: number; label: string; body: Partial<Pick<AdminComparsa, 'nombre' | 'nocheId' | 'orden' | 'activo'>> }
  | { type: 'deleteComparsa'; id: number; label: string }
  | { type: 'reorderComparsas'; id: number; label: string }
  | { type: 'updateItem'; id: number; label: string; body: Partial<Pick<AdminItem, 'nombre' | 'parentItemId' | 'orden' | 'activo'>> }
  | { type: 'deleteItem'; id: number; label: string }

const initialUser: UserForm = { nombre: '', dni: '', email: '', role: 'jurado', activo: true }
const initialNight: NightForm = { nombre: '', fecha: '' }
const initialComparsa: ComparsaForm = { nombre: '', nocheId: '', activo: true }
const initialItem: ItemForm = { nombre: '', parentItemId: '', orden: '1', activo: true }

function errorText(caught: unknown, fallback: string): string {
  return caught instanceof ApiClientError ? caught.message : fallback
}

function confirmTitle(action: ConfirmAction): string {
  if (action.type === 'openNight') return 'Abrir noche'
  if (action.type === 'closeNight') return 'Cerrar noche'
  if (action.type.startsWith('delete')) return 'Confirmar borrado'
  if (action.type === 'reorderComparsas') return 'Guardar orden'
  return 'Confirmar modificación'
}

function confirmDescription(action: ConfirmAction): string {
  if (action.type.startsWith('delete')) {
    return 'Esta acción intentará borrar el registro. Si ya tiene historial, el backend lo va a bloquear para preservar evidencia.'
  }
  return 'Acción operativa sensible: quedará auditada en backend. Verificá que corresponde antes de confirmar.'
}

function isDangerAction(action: ConfirmAction): boolean {
  return action.type !== 'openNight'
}

export function AdminPage() {
  const queryClient = useQueryClient()
  const [userForm, setUserForm] = useState<UserForm>(initialUser)
  const [nightForm, setNightForm] = useState<NightForm>(initialNight)
  const [comparsaForm, setComparsaForm] = useState<ComparsaForm>(initialComparsa)
  const [itemForm, setItemForm] = useState<ItemForm>(initialItem)
  const [orderDraft, setOrderDraft] = useState<Record<number, string>>({})
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const users = useQuery({ queryKey: ['admin-users'], queryFn: adminApi.users })
  const nights = useQuery({ queryKey: ['admin-nights'], queryFn: adminApi.nights })
  const comparsas = useQuery({ queryKey: ['admin-comparsas'], queryFn: adminApi.comparsas })
  const items = useQuery({ queryKey: ['admin-items'], queryFn: adminApi.items })

  const refreshAdmin = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-nights'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-comparsas'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-items'] })
  }

  const createUser = useMutation({
    mutationFn: () => adminApi.createUser(userForm),
    onSuccess: () => { setUserForm(initialUser); setMessage('Usuario creado.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo crear el usuario.')),
  })
  const createNight = useMutation({
    mutationFn: () => adminApi.createNight(nightForm),
    onSuccess: () => { setNightForm(initialNight); setMessage('Noche creada.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo crear la noche.')),
  })
  const createComparsa = useMutation({
    mutationFn: () => adminApi.createComparsa({
      nombre: comparsaForm.nombre,
      nocheId: Number(comparsaForm.nocheId),
      orden: Math.max(
        0,
        ...(comparsas.data ?? [])
          .filter((comparsa) => comparsa.nocheId === Number(comparsaForm.nocheId))
          .map((comparsa) => comparsa.orden),
      ) + 1,
      activo: comparsaForm.activo,
    }),
    onSuccess: () => { setComparsaForm(initialComparsa); setMessage('Comparsa creada.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo crear la comparsa.')),
  })
  const updateUser = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Omit<AdminUser, 'id' | 'createdAt' | 'updatedAt'>> }) => adminApi.updateUser(id, body),
    onSuccess: () => { setConfirm(null); setMessage('Usuario actualizado.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo modificar el usuario.')),
  })
  const deleteUser = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => { setConfirm(null); setMessage('Usuario borrado.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo borrar el usuario.')),
  })
  const updateNight = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Pick<AdminNight, 'nombre' | 'fecha'>> }) => adminApi.updateNight(id, body),
    onSuccess: () => { setConfirm(null); setMessage('Noche actualizada.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo modificar la noche.')),
  })
  const deleteNight = useMutation({
    mutationFn: adminApi.deleteNight,
    onSuccess: () => { setConfirm(null); setMessage('Noche borrada.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo borrar la noche.')),
  })
  const comparsasByNight = useMemo(() => {
    const grouped = new Map<number, AdminComparsa[]>()
    for (const comparsa of comparsas.data ?? []) {
      const current = grouped.get(comparsa.nocheId) ?? []
      current.push(comparsa)
      grouped.set(comparsa.nocheId, current)
    }
    return Array.from(grouped.entries()).map(([nightId, rows]) => [nightId, rows.sort((a, b) => a.orden - b.orden)] as const)
  }, [comparsas.data])

  const comparsasByNightMap = useMemo(() => new Map(comparsasByNight), [comparsasByNight])

  const reorderComparsas = useMutation({
    mutationFn: (nightId: number) => {
      const rows = comparsas.data?.filter((comparsa) => comparsa.nocheId === nightId) ?? []
      return adminApi.reorderComparsas(nightId, {
        comparsas: rows.map((comparsa) => ({
          comparsaId: comparsa.id,
          orden: Number(orderDraft[comparsa.id] ?? comparsa.orden),
        })),
      })
    },
    onSuccess: () => { setConfirm(null); setMessage('Orden de comparsas actualizado.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo modificar el orden.')),
  })
  const updateComparsa = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Pick<AdminComparsa, 'nombre' | 'nocheId' | 'orden' | 'activo'>> }) => adminApi.updateComparsa(id, body),
    onSuccess: () => { setConfirm(null); setMessage('Comparsa actualizada.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo modificar la comparsa.')),
  })
  const deleteComparsa = useMutation({
    mutationFn: adminApi.deleteComparsa,
    onSuccess: () => { setConfirm(null); setMessage('Comparsa borrada.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo borrar la comparsa.')),
  })
  const createItem = useMutation({
    mutationFn: () => adminApi.createItem({
      nombre: itemForm.nombre,
      ...(itemForm.parentItemId ? { parentItemId: Number(itemForm.parentItemId) } : { parentItemId: null }),
      orden: Number(itemForm.orden),
      activo: itemForm.activo,
    }),
    onSuccess: () => { setItemForm(initialItem); setMessage('Ítem creado.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo crear el ítem.')),
  })
  const updateItem = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Pick<AdminItem, 'nombre' | 'parentItemId' | 'orden' | 'activo'>> }) => adminApi.updateItem(id, body),
    onSuccess: () => { setConfirm(null); setMessage('Ítem actualizado.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo modificar el ítem.')),
  })
  const deleteItem = useMutation({
    mutationFn: adminApi.deleteItem,
    onSuccess: () => { setConfirm(null); setMessage('Ítem borrado.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo borrar el ítem.')),
  })
  const openNight = useMutation({
    mutationFn: (id: number) => adminApi.openNight(id),
    onSuccess: () => { setConfirm(null); setMessage('Noche abierta.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo abrir la noche.')),
  })
  const closeNight = useMutation({
    mutationFn: (id: number) => adminApi.closeNight(id),
    onSuccess: () => { setConfirm(null); setMessage('Noche cerrada.'); refreshAdmin() },
    onError: (caught) => setMessage(errorText(caught, 'No se pudo cerrar la noche.')),
  })
  const onUser = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); createUser.mutate() }
  const onNight = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); createNight.mutate() }
  const onComparsa = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); createComparsa.mutate() }
  const onItem = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); createItem.mutate() }

  const busy = createUser.isPending || createNight.isPending || createComparsa.isPending || reorderComparsas.isPending || createItem.isPending || openNight.isPending || closeNight.isPending || updateUser.isPending || deleteUser.isPending || updateNight.isPending || deleteNight.isPending || updateComparsa.isPending || deleteComparsa.isPending || updateItem.isPending || deleteItem.isPending

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-5">
      {message ? <Card className="border-cyan-500/40 bg-cyan-500/10"><p className="text-cyan-100">{message}</p></Card> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-bold">Usuarios</h2>
          <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={onUser}>
            <input id="admin-user-name" name="nombre" aria-label="Nombre" placeholder="Nombre" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={userForm.nombre} onChange={(event) => setUserForm({ ...userForm, nombre: event.target.value })} />
            <input id="admin-user-dni" name="dni" aria-label="DNI" placeholder="DNI" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={userForm.dni} onChange={(event) => setUserForm({ ...userForm, dni: event.target.value })} />
            <input id="admin-user-email" name="email" aria-label="Email" placeholder="Email" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
            <select id="admin-user-role" name="role" aria-label="Rol" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value as Role })}><option value="jurado">Jurado</option><option value="fiscal">Fiscal</option><option value="escribano">Escribano</option><option value="admin">Admin</option></select>
            <Button type="submit" disabled={busy}>Crear usuario</Button>
          </form>
          <div className="mt-4 max-h-80 space-y-2 overflow-auto">
            {(users.data ?? []).map((user) => (
              <div key={user.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm">
                <p className="font-semibold">{user.nombre}</p>
                <p className="text-slate-400">{user.email} · {user.role} · {user.activo ? 'activo' : 'inactivo'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={busy} onClick={() => {
                    const nombre = window.prompt('Nuevo nombre', user.nombre)
                    if (nombre?.trim()) setConfirm({ type: 'updateUser', id: user.id, label: user.nombre, body: { nombre: nombre.trim() } })
                  }}>Modificar</Button>
                  <Button variant="danger" disabled={busy || !user.activo} onClick={() => setConfirm({ type: 'deleteUser', id: user.id, label: user.nombre })}>Borrar</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Noches</h2>
          <form className="mt-3 grid gap-3 sm:grid-cols-3" onSubmit={onNight}>
            <input id="admin-night-name" name="nightName" aria-label="Nombre de noche" placeholder="Nombre" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={nightForm.nombre} onChange={(event) => setNightForm({ ...nightForm, nombre: event.target.value })} />
            <input id="admin-night-date" name="nightDate" aria-label="Fecha" type="date" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={nightForm.fecha} onChange={(event) => setNightForm({ ...nightForm, fecha: event.target.value })} />
            <Button type="submit" disabled={busy}>Crear noche</Button>
          </form>
          <div className="mt-4 space-y-2">
            {(nights.data ?? []).map((night) => <div key={night.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm"><div><p className="font-semibold">#{night.id} · {night.nombre}</p><p className="text-slate-400">{night.fecha}</p></div><Badge tone={night.estado === 'open' ? 'success' : 'warning'}>{night.estado}</Badge><div className="flex gap-2"><Button variant="secondary" onClick={() => {
              const nombre = window.prompt('Nuevo nombre de noche', night.nombre)
              if (nombre?.trim()) setConfirm({ type: 'updateNight', id: night.id, label: night.nombre, body: { nombre: nombre.trim() } })
            }}>Modificar</Button><Button variant="secondary" onClick={() => setConfirm({ type: 'openNight', id: night.id, label: night.nombre })}>Abrir</Button><Button variant="danger" onClick={() => setConfirm({ type: 'closeNight', id: night.id, label: night.nombre })}>Cerrar</Button><Button variant="danger" disabled={busy} onClick={() => setConfirm({ type: 'deleteNight', id: night.id, label: night.nombre })}>Borrar</Button></div></div>)}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Comparsas</h2>
          <p className="mt-2 text-sm text-slate-400">CRUD de comparsas. El orden de pasada se administra en una sección separada por noche.</p>
          <form className="mt-3 grid gap-3 sm:grid-cols-3" onSubmit={onComparsa}>
            <input aria-label="Nombre comparsa" placeholder="Nombre" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={comparsaForm.nombre} onChange={(event) => setComparsaForm({ ...comparsaForm, nombre: event.target.value })} />
            <select aria-label="Noche de comparsa" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={comparsaForm.nocheId} onChange={(event) => setComparsaForm({ ...comparsaForm, nocheId: event.target.value })}>
              <option value="">Seleccionar noche</option>
              {(nights.data ?? []).map((night) => <option key={night.id} value={night.id}>{night.nombre}</option>)}
            </select>
            <Button type="submit" disabled={busy}>Crear comparsa</Button>
          </form>
          <div className="mt-4 max-h-80 space-y-2 overflow-auto">
            {(comparsas.data ?? []).map((comparsa) => (
              <div key={comparsa.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm">
                <p className="font-semibold">{comparsa.nombre} {!comparsa.activo ? <em className="text-rose-200">(inactiva)</em> : null}</p>
                <p className="text-slate-400">Noche: {comparsa.nocheNombre ?? comparsa.nocheId}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={busy} onClick={() => {
                    const nombre = window.prompt('Nuevo nombre de comparsa', comparsa.nombre)
                    if (nombre?.trim()) setConfirm({ type: 'updateComparsa', id: comparsa.id, label: comparsa.nombre, body: { nombre: nombre.trim() } })
                  }}>Modificar</Button>
                  <Button variant="danger" disabled={busy || !comparsa.activo} onClick={() => setConfirm({ type: 'deleteComparsa', id: comparsa.id, label: comparsa.nombre })}>Borrar</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Orden de comparsas por noche</h2>
          <p className="mt-2 text-sm text-slate-400">Cada noche tiene su propio orden. Modificá los números y guardá el orden de esa noche.</p>
          <div className="mt-4 max-h-80 space-y-4 overflow-auto">
            {(nights.data ?? []).map((night) => {
              const rows = comparsasByNightMap.get(night.id) ?? []
              return (
                <div key={night.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{night.nombre}</p>
                      <p className="text-sm text-slate-400">{night.fecha}</p>
                    </div>
                    <Button variant="secondary" disabled={busy || rows.length === 0} onClick={() => setConfirm({ type: 'reorderComparsas', id: night.id, label: night.nombre })}>Guardar orden</Button>
                  </div>
                <div className="grid gap-2">
                  {rows.map((comparsa) => (
                    <label key={comparsa.id} className="grid grid-cols-[1fr_5rem] items-center gap-3 text-sm">
                      <span>{comparsa.nombre} {!comparsa.activo ? <em className="text-rose-200">(inactiva)</em> : null}</span>
                      <input
                        aria-label={`Orden ${comparsa.nombre}`}
                        className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3"
                        inputMode="numeric"
                        value={orderDraft[comparsa.id] ?? String(comparsa.orden)}
                        onChange={(event) => setOrderDraft({ ...orderDraft, [comparsa.id]: event.target.value })}
                      />
                    </label>
                  ))}
                  {rows.length === 0 ? <p className="text-sm text-slate-400">Esta noche todavía no tiene comparsas.</p> : null}
                </div>
              </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Rubros / Ítems</h2>
          <form className="mt-3 grid gap-3 sm:grid-cols-4" onSubmit={onItem}>
            <input id="admin-item-name" name="itemName" aria-label="Nombre ítem" placeholder="Nombre" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={itemForm.nombre} onChange={(event) => setItemForm({ ...itemForm, nombre: event.target.value })} />
            <input id="admin-item-parent" name="parentItemId" aria-label="Ítem padre" placeholder="Padre opcional" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={itemForm.parentItemId} onChange={(event) => setItemForm({ ...itemForm, parentItemId: event.target.value })} />
            <input id="admin-item-order" name="itemOrder" aria-label="Orden ítem" placeholder="Orden" className="min-h-11 rounded-2xl border border-slate-700 bg-slate-950 px-3" value={itemForm.orden} onChange={(event) => setItemForm({ ...itemForm, orden: event.target.value })} />
            <Button type="submit" disabled={busy}>Crear ítem</Button>
          </form>
          <div className="mt-4 max-h-80 space-y-2 overflow-auto">{(items.data ?? []).map((item) => <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm"><p>#{item.id} · {item.nombre} · padre {item.parentItemId ?? '-'} · orden {item.orden} · {item.activo ? 'activo' : 'inactivo'}</p><div className="mt-2 flex gap-2"><Button variant="secondary" disabled={busy} onClick={() => {
            const nombre = window.prompt('Nuevo nombre de ítem', item.nombre)
            if (nombre?.trim()) setConfirm({ type: 'updateItem', id: item.id, label: item.nombre, body: { nombre: nombre.trim() } })
          }}>Modificar</Button><Button variant="danger" disabled={busy || !item.activo} onClick={() => setConfirm({ type: 'deleteItem', id: item.id, label: item.nombre })}>Borrar</Button></div></div>)}</div>
        </Card>
      </div>

      <Modal
        open={Boolean(confirm)}
        title={confirm ? confirmTitle(confirm) : 'Confirmar acción'}
        description={confirm ? confirmDescription(confirm) : ''}
        confirmLabel="Confirmar"
        danger={confirm ? isDangerAction(confirm) : true}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return
          if (confirm.type === 'updateUser') updateUser.mutate({ id: confirm.id, body: confirm.body })
          if (confirm.type === 'deleteUser') deleteUser.mutate(confirm.id)
          if (confirm.type === 'updateNight') updateNight.mutate({ id: confirm.id, body: confirm.body })
          if (confirm.type === 'deleteNight') deleteNight.mutate(confirm.id)
          if (confirm.type === 'openNight') openNight.mutate(confirm.id)
          if (confirm.type === 'closeNight') closeNight.mutate(confirm.id)
          if (confirm.type === 'updateComparsa') updateComparsa.mutate({ id: confirm.id, body: confirm.body })
          if (confirm.type === 'deleteComparsa') deleteComparsa.mutate(confirm.id)
          if (confirm.type === 'reorderComparsas') reorderComparsas.mutate(confirm.id)
          if (confirm.type === 'updateItem') updateItem.mutate({ id: confirm.id, body: confirm.body })
          if (confirm.type === 'deleteItem') deleteItem.mutate(confirm.id)
        }}
      >
        <p className="text-slate-100">{confirm?.label}</p>
      </Modal>
    </main>
  )
}
