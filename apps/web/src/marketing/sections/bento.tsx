import { BentoGrid, BentoGridItem } from '@ticket/ui/primitives/bento-grid';
import { Card, CardContent, CardTitle } from '@ticket/ui/primitives/card';
import { cn } from '@ticket/ui/cn';
import Image from 'next/image';
import { BENTO_CELLS } from '../content-config';
import { t, type CopyKey } from '../copy';
import {
  marketingBentoCard,
  marketingBentoCardBody,
  marketingBentoCardInner,
  marketingBentoCardInnerSpan,
  marketingBentoCardTitle,
  marketingBentoCopy,
  marketingBentoFigure,
  marketingBentoGrid,
  marketingBentoImg,
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

const CELL_ALT: Record<BentoCellKey, CopyKey> = {
  'bento.invite': 'bento.invite.alt',
  'bento.qr': 'bento.qr.alt',
  'bento.gate': 'bento.gate.alt',
  'bento.offline': 'bento.offline.alt',
  'bento.admin': 'bento.admin.alt',
  'bento.whitelabel': 'bento.whitelabel.alt',
  'bento.ops': 'bento.ops.alt',
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
                  <CardContent
                    className={cn(
                      marketingBentoCardInner,
                      marketingBentoCardInnerSpan(span),
                    )}
                  >
                    <div className={marketingBentoCopy}>
                      <CardTitle id={titleId} className={marketingBentoCardTitle}>
                        {t(locale, CELL_TITLE[key])}
                      </CardTitle>
                      <p id={bodyId} className={marketingBentoCardBody}>
                        {t(locale, CELL_BODY[key])}
                      </p>
                    </div>
                    <figure className={marketingBentoFigure} data-span={span}>
                      <Image
                        className={marketingBentoImg}
                        src={cell.image.src}
                        alt={t(locale, CELL_ALT[key])}
                        width={cell.image.width}
                        height={cell.image.height}
                        sizes={
                          cell.colSpan >= 4
                            ? '(max-width: 768px) 100vw, 92vw'
                            : cell.colSpan >= 2
                              ? '(max-width: 768px) 100vw, 42vw'
                              : '(max-width: 768px) 100vw, 22vw'
                        }
                        loading="lazy"
                      />
                    </figure>
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
