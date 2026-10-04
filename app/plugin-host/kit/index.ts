import { markRaw } from 'vue'
import { UBadge, USelect, UTextarea } from '#components'
import type { ComponentKit } from '../contract'
import KitButton from './KitButton.vue'
import KitIcon from './KitIcon.vue'
import KitItemCard from './KitItemCard.vue'

export const componentKit: ComponentKit = Object.freeze({
  Button: markRaw(KitButton),
  Icon: markRaw(KitIcon),
  Badge: markRaw(UBadge),
  Select: markRaw(USelect),
  Textarea: markRaw(UTextarea),
  ItemCard: markRaw(KitItemCard),
})
