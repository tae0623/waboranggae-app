/** Remove a repeated city prefix without cutting 시립, 시청, 군청, etc. */
export function placeNameWithoutCity(name: string, city: string) {
  const value=name.trim();
  if(!city || !value.startsWith(city))return value;
  const rest=value.slice(city.length).replace(/^(?:시|군)(?=\s)/,'').trim();
  return rest || value;
}
