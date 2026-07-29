{{-- Add-unit modal --}}
<div x-data="{ open: false }" x-on:open-modal.window="if ($event.detail === 'add-unit') open = true"
     x-show="open" x-cloak class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
    <div class="card w-full max-w-md p-6" @click.outside="open = false">
        <div class="flex justify-between items-center mb-4"><h2 class="text-lg font-semibold">Add unit</h2><button @click="open=false" class="text-slate-400">✕</button></div>
        <form method="POST" action="{{ route('units.store') }}" class="space-y-3">
            @csrf
            <input type="hidden" name="project_id" value="{{ $projectId }}">
            <div><label class="block text-xs mb-1">Unit number</label><input name="unit_number" class="input" required></div>
            <div><label class="block text-xs mb-1">Price (₹)</label><input type="number" step="0.01" name="price" class="input" required></div>
            <div class="flex justify-end gap-2 pt-2"><button type="button" @click="open=false" class="btn-secondary">Cancel</button><button class="btn-primary">Add</button></div>
        </form>
    </div>
</div>

{{-- Bulk-units modal --}}
<div x-data="{ open: false }" x-on:open-modal.window="if ($event.detail === 'bulk-units') open = true"
     x-show="open" x-cloak class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
    <div class="card w-full max-w-md p-6" @click.outside="open = false">
        <div class="flex justify-between items-center mb-4"><h2 class="text-lg font-semibold">Bulk create units</h2><button @click="open=false" class="text-slate-400">✕</button></div>
        <form method="POST" action="{{ route('units.bulk') }}" class="space-y-3">
            @csrf
            <input type="hidden" name="project_id" value="{{ $projectId }}">
            <div><label class="block text-xs mb-1">Prefix (e.g. A-)</label><input name="prefix" class="input" required></div>
            <div class="grid grid-cols-3 gap-3">
                <div><label class="block text-xs mb-1">Start</label><input type="number" name="start" class="input" required></div>
                <div><label class="block text-xs mb-1">End</label><input type="number" name="end" class="input" required></div>
                <div><label class="block text-xs mb-1">Padding</label><input type="number" name="padding" value="0" class="input"></div>
            </div>
            <div><label class="block text-xs mb-1">Base price (₹)</label><input type="number" step="0.01" name="base_price" class="input" required></div>
            <p class="text-xs text-slate-500">Max 500 units per batch. Duplicates will be skipped.</p>
            <div class="flex justify-end gap-2 pt-2"><button type="button" @click="open=false" class="btn-secondary">Cancel</button><button class="btn-primary">Create</button></div>
        </form>
    </div>
</div>

{{-- Sell-unit modal --}}
<div x-data="{ open: false, unitId: null, num: '', price: 0 }"
     x-on:open-modal.window="if ($event.detail.name === 'sell-unit') { open = true; unitId = $event.detail.id; num = $event.detail.num; price = $event.detail.price }"
     x-show="open" x-cloak class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
    <div class="card w-full max-w-md p-6" @click.outside="open = false">
        <div class="flex justify-between items-center mb-4"><h2 class="text-lg font-semibold">Sell unit <span x-text="num"></span></h2><button @click="open=false" class="text-slate-400">✕</button></div>
        <form :action="'/units/' + unitId + '/sell'" method="POST" class="space-y-3">
            @csrf
            <div><label class="block text-xs mb-1">Buyer name</label><input name="buyer_name" class="input" required></div>
            <div><label class="block text-xs mb-1">Buyer contact</label><input name="buyer_contact" class="input"></div>
            <div><label class="block text-xs mb-1">Final price (₹)</label><input type="number" step="0.01" name="price" x-bind:value="price" class="input" required></div>
            <div class="flex justify-end gap-2 pt-2"><button type="button" @click="open=false" class="btn-secondary">Cancel</button><button class="btn-primary">Confirm sale</button></div>
        </form>
    </div>

{{-- Excel-import modal --}}
<div x-data="{ open: false }" x-on:open-modal.window="if ($event.detail === 'import-units') open = true"
     x-show="open" x-cloak class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
    <div class="card w-full max-w-md p-6" @click.outside="open = false">
        <div class="flex justify-between items-center mb-4"><h2 class="text-lg font-semibold">Import units from Excel</h2><button @click="open=false" class="text-slate-400">✕</button></div>
        <form method="POST" action="{{ route('imports.units') }}" enctype="multipart/form-data" class="space-y-3">
            @csrf
            <input type="hidden" name="project_id" value="{{ $projectId }}">
            <div>
                <label class="block text-xs mb-1">File (.xlsx / .csv)</label>
                <input type="file" name="file" accept=".xlsx,.csv,.xls" class="text-sm" required>
            </div>
            <div class="text-xs text-slate-500 bg-slate-50 rounded p-3">
                <p class="font-medium mb-1">Required columns (header row):</p>
                <code>unit_number, price, status, bhk, floor, carpet, facing, dimensions</code>
                <p class="mt-2">Only <b>unit_number</b> is required. Extra columns are ignored.</p>
            </div>
            <div class="flex justify-end gap-2 pt-2"><button type="button" @click="open=false" class="btn-secondary">Cancel</button><button class="btn-primary">Import</button></div>
        </form>
    </div>
</div>

</div>
