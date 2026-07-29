<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\StockItem;
use App\Models\StockMovement;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class StockController extends Controller
{
    public function index(Request $request): View
    {
        $user = $request->user();
        $projects = $user->isAdmin()
            ? Project::orderBy('name')->get()
            : $user->projects()->orderBy('name')->get();

        $projectId = $request->integer('project_id') ?: $projects->first()?->id;

        $items = $projectId
            ? StockItem::where('project_id', $projectId)->orderBy('name')->get()
            : collect();

        return view('stock.index', compact('projects', 'projectId', 'items'));
    }

    public function storeItem(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'name' => ['required', 'string', 'max:120'],
            'unit' => ['required', 'string', 'max:20'],
            'opening' => ['required', 'numeric', 'min:0'],
        ]);
        StockItem::create($data);
        return back()->with('status', 'Item added.');
    }

    public function storeMovement(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'stock_item_id' => ['required', 'exists:stock_items,id'],
            'kind' => ['required', 'in:inward,outward'],
            'quantity' => ['required', 'numeric', 'min:0.01'],
            'moved_on' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);
        $item = StockItem::findOrFail($data['stock_item_id']);
        StockMovement::create($data + [
            'project_id' => $item->project_id,
            'recorded_by' => auth()->id(),
        ]);
        return back()->with('status', 'Movement recorded.');
    }
}
