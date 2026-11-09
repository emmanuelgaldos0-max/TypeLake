/**
 * Supabase devuelve como máximo 1000 filas por consulta. Esta función pide
 * páginas sucesivas hasta traer todo.
 */
export async function traerTodo<T>(
  pedir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  tamano = 1000,
): Promise<T[]> {
  const todo: T[] = [];
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await pedir(desde, desde + tamano - 1);
    if (error) throw new Error(error.message);
    todo.push(...(data ?? []));
    if (!data || data.length < tamano) break;
  }
  return todo;
}
