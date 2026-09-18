import { useState } from 'react';
import { useRepository, useRepositoryData, useWrite } from '@/app/hooks';
import { useSettings } from '@/app/SettingsProvider';
import { toast } from '@/app/store';
import { Button, Card, Chip, IconButton, NumberInput, Sheet, TextInput } from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import { uuid } from '@/domain/ids';
import type { BarProfile, PlateInventory } from '@/domain/types';
import { formatWeight, toGrams } from '@/domain/units';

/** Bars and plate inventories — the inputs the plate calculator and warm-up ramps use. */
export function EquipmentSettings() {
  const repository = useRepository();
  const { weightUnit } = useSettings();
  const [editingBar, setEditingBar] = useState<BarProfile | null>(null);
  const [editingInventory, setEditingInventory] = useState<PlateInventory | null>(null);

  const { data, reload } = useRepositoryData(
    async (repo) => ({
      bars: await repo.listBarProfiles(),
      inventories: await repo.listPlateInventories(),
    }),
    [],
  );

  const [saveBar] = useWrite(async (bar: BarProfile) => {
    await repository.saveBarProfile(bar);
    setEditingBar(null);
    reload();
  });

  const [deleteBar] = useWrite(async (id: string) => {
    await repository.deleteBarProfile(id);
    toast.info('Bar removed.');
    reload();
  });

  const [saveInventory] = useWrite(async (inventory: PlateInventory) => {
    await repository.savePlateInventory(inventory);
    setEditingInventory(null);
    reload();
  });

  const [deleteInventory] = useWrite(async (id: string) => {
    await repository.deletePlateInventory(id);
    toast.info('Inventory removed.');
    reload();
  });

  return (
    <>
      <Card className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Bars</h3>
          <Button
            size="sm"
            onClick={() =>
              setEditingBar({
                id: uuid(),
                name: '',
                weightG: toGrams(20, 'kg'),
                collarWeightG: 0,
                isDefault: false,
              })
            }
          >
            Add bar
          </Button>
        </div>
        <ul className="space-y-1.5">
          {(data?.bars ?? []).map((bar) => (
            <li
              key={bar.id}
              className="flex items-center justify-between gap-2 rounded border border-line px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink">{bar.name}</span>
                <span className="text-xs text-ink-subtle">
                  {formatWeight(bar.weightG, weightUnit)} {weightUnit}
                  {bar.collarWeightG > 0 &&
                    ` · collars ${formatWeight(bar.collarWeightG, weightUnit)} ${weightUnit}`}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {bar.isDefault && <Chip tone="accent">Default</Chip>}
                <Button size="sm" variant="ghost" onClick={() => setEditingBar(bar)}>
                  Edit
                </Button>
                <IconButton label={`Delete ${bar.name}`} onClick={() => void deleteBar(bar.id)}>
                  <Icon icon={Icons.trash} size={16} />
                </IconButton>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Plate inventories</h3>
          <Button
            size="sm"
            onClick={() =>
              setEditingInventory({
                id: uuid(),
                name: '',
                unit: weightUnit,
                plates: [],
                isDefault: false,
              })
            }
          >
            Add inventory
          </Button>
        </div>
        <p className="mb-2 text-xs text-ink-subtle">
          Counts are <strong>total physical plates</strong>, not pairs. Two 20 kg plates make one
          usable pair.
        </p>
        <ul className="space-y-1.5">
          {(data?.inventories ?? []).map((inventory) => (
            <li
              key={inventory.id}
              className="flex items-center justify-between gap-2 rounded border border-line px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink">{inventory.name}</span>
                <span className="block truncate text-xs text-ink-subtle">
                  {inventory.plates
                    .map(
                      (plate) => `${plate.count}× ${formatWeight(plate.weightG, inventory.unit)}`,
                    )
                    .join(', ') || 'No plates yet'}{' '}
                  {inventory.unit}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {inventory.isDefault && <Chip tone="accent">Default</Chip>}
                <Button size="sm" variant="ghost" onClick={() => setEditingInventory(inventory)}>
                  Edit
                </Button>
                <IconButton
                  label={`Delete ${inventory.name}`}
                  onClick={() => void deleteInventory(inventory.id)}
                >
                  <Icon icon={Icons.trash} size={16} />
                </IconButton>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <BarEditor
        bar={editingBar}
        onClose={() => setEditingBar(null)}
        onSave={(bar) => void saveBar(bar)}
      />
      <InventoryEditor
        inventory={editingInventory}
        onClose={() => setEditingInventory(null)}
        onSave={(inventory) => void saveInventory(inventory)}
      />
    </>
  );
}

function BarEditor({
  bar,
  onClose,
  onSave,
}: {
  bar: BarProfile | null;
  onClose: () => void;
  onSave: (bar: BarProfile) => void;
}) {
  const { weightUnit } = useSettings();
  const [draft, setDraft] = useState<BarProfile | null>(bar);
  const [key, setKey] = useState<string | null>(null);

  if (bar && key !== bar.id) {
    setKey(bar.id);
    setDraft(bar);
  }

  return (
    <Sheet
      open={!!bar}
      onClose={onClose}
      title={bar?.name ? `Edit ${bar.name}` : 'New bar'}
      footer={
        <div className="flex gap-2">
          <Button block onClick={onClose}>
            Cancel
          </Button>
          <Button
            block
            variant="primary"
            onClick={() => {
              if (!draft) return;
              onSave({ ...draft, name: draft.name.trim() || 'Custom bar' });
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      {draft && (
        <>
          <label className="rf-label" htmlFor="bar-name">
            Name
          </label>
          <TextInput
            id="bar-name"
            data-autofocus
            className="mb-3"
            value={draft.name}
            maxLength={80}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          <label className="rf-label" htmlFor="bar-weight">
            Bar weight ({weightUnit})
          </label>
          <NumberInput
            id="bar-weight"
            className="mb-3"
            step="any"
            min={0}
            value={formatWeight(draft.weightG, weightUnit)}
            onChange={(event) =>
              setDraft({
                ...draft,
                weightG: toGrams(Number.parseFloat(event.target.value) || 0, weightUnit),
              })
            }
          />
          <label className="rf-label" htmlFor="bar-collar">
            Collar weight, each ({weightUnit})
          </label>
          <NumberInput
            id="bar-collar"
            className="mb-3"
            step="any"
            min={0}
            value={formatWeight(draft.collarWeightG, weightUnit)}
            onChange={(event) =>
              setDraft({
                ...draft,
                collarWeightG: toGrams(Number.parseFloat(event.target.value) || 0, weightUnit),
              })
            }
          />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={draft.isDefault}
              onChange={(event) => setDraft({ ...draft, isDefault: event.target.checked })}
            />
            Use as my default bar
          </label>
        </>
      )}
    </Sheet>
  );
}

function InventoryEditor({
  inventory,
  onClose,
  onSave,
}: {
  inventory: PlateInventory | null;
  onClose: () => void;
  onSave: (inventory: PlateInventory) => void;
}) {
  const [draft, setDraft] = useState<PlateInventory | null>(inventory);
  const [key, setKey] = useState<string | null>(null);

  if (inventory && key !== inventory.id) {
    setKey(inventory.id);
    setDraft(inventory);
  }

  const patchPlate = (index: number, patch: { weightG?: number; count?: number }) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            plates: current.plates.map((plate, i) =>
              i === index ? { ...plate, ...patch } : plate,
            ),
          }
        : current,
    );
  };

  return (
    <Sheet
      open={!!inventory}
      onClose={onClose}
      title={inventory?.name ? `Edit ${inventory.name}` : 'New plate inventory'}
      footer={
        <div className="flex gap-2">
          <Button block onClick={onClose}>
            Cancel
          </Button>
          <Button
            block
            variant="primary"
            onClick={() => {
              if (!draft) return;
              onSave({
                ...draft,
                name: draft.name.trim() || 'My plates',
                plates: draft.plates.filter((plate) => plate.weightG > 0),
              });
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      {draft && (
        <>
          <label className="rf-label" htmlFor="inventory-name">
            Name
          </label>
          <TextInput
            id="inventory-name"
            data-autofocus
            className="mb-3"
            value={draft.name}
            maxLength={80}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />

          <p className="rf-label">Plates ({draft.unit})</p>
          <ul className="space-y-1.5">
            {draft.plates.map((plate, index) => (
              <li key={index} className="flex items-center gap-2">
                <NumberInput
                  aria-label={`Plate ${index + 1} weight`}
                  className="h-10 min-h-0 w-24"
                  step="any"
                  min={0}
                  value={formatWeight(plate.weightG, draft.unit)}
                  onChange={(event) =>
                    patchPlate(index, {
                      weightG: toGrams(Number.parseFloat(event.target.value) || 0, draft.unit),
                    })
                  }
                />
                <span className="text-xs text-ink-subtle">{draft.unit} ×</span>
                <NumberInput
                  aria-label={`Plate ${index + 1} count`}
                  className="h-10 min-h-0 w-20"
                  min={0}
                  inputMode="numeric"
                  value={plate.count}
                  onChange={(event) =>
                    patchPlate(index, {
                      count: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                    })
                  }
                />
                <IconButton
                  label={`Remove plate ${index + 1}`}
                  onClick={() =>
                    setDraft({ ...draft, plates: draft.plates.filter((_, i) => i !== index) })
                  }
                >
                  <Icon icon={Icons.trash} size={16} />
                </IconButton>
              </li>
            ))}
          </ul>

          <Button
            className="mt-2"
            size="sm"
            onClick={() =>
              setDraft({
                ...draft,
                plates: [
                  ...draft.plates,
                  { weightG: toGrams(draft.unit === 'kg' ? 20 : 45, draft.unit), count: 2 },
                ],
              })
            }
          >
            + Add plate size
          </Button>

          <label className="mt-4 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={draft.isDefault}
              onChange={(event) => setDraft({ ...draft, isDefault: event.target.checked })}
            />
            Use as my default inventory
          </label>
        </>
      )}
    </Sheet>
  );
}
