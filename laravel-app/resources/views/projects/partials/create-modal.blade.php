<div
    x-data="{ open: false }"
    x-on:open-modal.window="if ($event.detail === 'create-project') open = true"
    x-on:keydown.escape.window="open = false"
    x-show="open" x-cloak
    class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
    <div class="card w-full max-w-lg p-6" @click.outside="open = false">
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-lg font-semibold">New project</h2>
            <button @click="open = false" class="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <form method="POST" action="{{ route('projects.store') }}" enctype="multipart/form-data" class="space-y-3">
            @csrf
            <div class="grid grid-cols-2 gap-3">
                <div class="col-span-2">
                    <label class="block text-xs font-medium text-slate-600 mb-1">Name</label>
                    <input type="text" name="name" class="input" required>
                </div>
                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">Project type</label>
                    <select name="project_type" class="input" required>
                        <option value="residential">Residential</option>
                        <option value="commercial">Commercial</option>
                        <option value="plot">Plot</option>
                        <option value="villa">Villa</option>
                        <option value="mixed">Mixed-use</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">Developer</label>
                    <input type="text" name="developer" class="input">
                </div>
                <div class="col-span-2">
                    <label class="block text-xs font-medium text-slate-600 mb-1">Address</label>
                    <input type="text" name="address" class="input">
                </div>
                <div><label class="block text-xs font-medium text-slate-600 mb-1">City</label><input name="city" class="input"></div>
                <div><label class="block text-xs font-medium text-slate-600 mb-1">State</label><input name="state" class="input"></div>
                <div><label class="block text-xs font-medium text-slate-600 mb-1">Pincode</label><input name="pincode" class="input"></div>
                <div><label class="block text-xs font-medium text-slate-600 mb-1">RERA number</label><input name="rera_number" class="input"></div>
                <div><label class="block text-xs font-medium text-slate-600 mb-1">Start date</label><input type="date" name="start_date" class="input"></div>
                <div><label class="block text-xs font-medium text-slate-600 mb-1">Expected completion</label><input type="date" name="expected_completion" class="input"></div>
                <div><label class="block text-xs font-medium text-slate-600 mb-1">Total units planned</label><input type="number" name="total_units_planned" class="input"></div>
                <div><label class="block text-xs font-medium text-slate-600 mb-1">Target revenue (₹)</label><input type="number" step="0.01" name="target_revenue" class="input"></div>
                <div class="col-span-2">
                    <label class="block text-xs font-medium text-slate-600 mb-1">Cover image</label>
                    <input type="file" name="image" accept="image/*" class="text-sm">
                </div>
            </div>
            <div class="flex justify-end gap-2 pt-2">
                <button type="button" @click="open = false" class="btn-secondary">Cancel</button>
                <button type="submit" class="btn-primary">Create project</button>
            </div>
        </form>
    </div>
</div>
