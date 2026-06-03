import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()

  return (
    <Select value={i18n.language} onValueChange={(value) => i18n.changeLanguage(value)}>
      <SelectTrigger className="w-[110px] h-9" aria-label={t('app.language.switchLabel')}>
        <Languages className="h-4 w-4 mr-1" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="zh">{t('app.language.zh')}</SelectItem>
        <SelectItem value="en">{t('app.language.en')}</SelectItem>
      </SelectContent>
    </Select>
  )
}
