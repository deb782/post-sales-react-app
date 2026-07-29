<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\View\View;

class AuditLogController extends Controller
{
    public function index(Request $request): View
    {
        $logs = AuditLog::with('actor')
            ->when($request->filled('action'), fn($q) => $q->where('action', 'like', $request->action.'%'))
            ->when($request->filled('entity_type'), fn($q) => $q->where('entity_type', $request->entity_type))
            ->orderBy('created_at', 'desc')
            ->limit(300)->get();

        return view('audit.index', compact('logs'));
    }
}
