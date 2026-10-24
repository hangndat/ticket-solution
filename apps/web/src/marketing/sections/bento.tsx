import { BentoGrid, BentoGridItem } from '@ticket/ui/primitives/bento-grid';
import { Card, CardContent, CardTitle } from '@ticket/ui/primitives/card';
import { BENTO_CELLS } from '../content-config';
import { t, type CopyKey } from '../copy';
import {
  marketingBentoCard,
  marketingBentoCardBody,
  marketingBentoCardInnerText,
  marketingBentoCardTitle,
  marketingBentoCopy,
  marketingBentoGrid,
  marketingBentoItem,
  marketingH2,
  marketingLead,
  marketingSection,
  marketingWrap,
} from '../marketing-surface';
import type { MarketingSectionProps } from './types';

type BentoCellKey =
  | 'bento.invite'
  | 'bento.qr'
  | 'bento.gate'
  | 'bento.offline'
  | 'bento.admin'
  | 'bento.whitelabel'
  | 'bento.ops';

const CELL_TITLE: Record<BentoCellKey, CopyKey> = {
  'bento.invite': 'bento.invite.title',
  'bento.qr': 'bento.qr.title',
  'bento.gate': 'bento.gate.title',
  'bento.offline': 'bento.offline.title',
  'bento.admin': 'bento.admin.title',
  'bento.whitelabel': 'bento.whitelabel.title',
  'bento.ops': 'bento.ops.title',
};

const CELL_BODY: Record<BentoCellKey, CopyKey> = {
  'bento.invite': 'bento.invite.body',
  'bento.qr': 'bento.qr.body',
  'bento.gate': 'bento.gate.body',
  'bento.offline': 'bento.offline.body',
  'bento.admin': 'bento.admin.body',
  'bento.whitelabel': 'bento.whitelabel.body',
  'bento.ops': 'bento.ops.body',
};

export function BentoSection({ locale }: MarketingSectionProps) {
  return (
    <section
      id="features"
      className={marketingSection('paper')}
      aria-labelledby="bento-title"
      data-analytics-section="features"
      data-testid="marketing-bento"
    >
      <div className={marketingWrap}>
        <h2 id="bento-title" className={marketingH2}>
          {t(locale, 'bento.title')}
        </h2>
        <p className={marketingLead}>{t(locale, 'bento.lead')}</p>
        <BentoGrid className={marketingBentoGrid}>
          {BENTO_CELLS.map((cell) => {
            const titleId = `${cell.id}-title`;
            const bodyId = `${cell.id}-body`;
            const key = cell.key as BentoCellKey;
            const span = cell.id.replace('bento-', '');
            return (
              <BentoGridItem
                key={cell.id}
                colSpan={cell.colSpan}
                rowSpan={cell.rowSpan}
                featured={cell.featured}
                className={marketingBentoItem}
                data-span={span}
                data-testid="marketing-bento-item"
              >
                <Card
                  variant="outline"
                  className={marketingBentoCard}
                  aria-labelledby={titleId}
                  aria-describedby={bodyId}
                >
                  <CardContent className={marketingBentoCardInnerText}>
                    <div className={marketingBentoCopy}>
                      <CardTitle id={titleId} className={marketingBentoCardTitle}>
                        {t(locale, CELL_TITLE[key])}
                      </CardTitle>
                      <p id={bodyId} className={marketingBentoCardBody}>
                        {t(locale, CELL_BODY[key])}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </BentoGridItem>
            );
          })}
        </BentoGrid>
      </div>
    </section>
  );
}
