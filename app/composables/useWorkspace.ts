/** One client session shared by the library, project pages and dialogs. */
export const useWorkspace = () => useNuxtApp().$workspace
