<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function poll(Request $request): JsonResponse
    {
        $items = Notification::where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')->limit(20)->get();
        $unread = $items->where('is_read', false)->count();
        return response()->json(['items' => $items, 'unread' => $unread]);
    }

    public function markRead(Notification $notification): RedirectResponse
    {
        abort_unless($notification->user_id === auth()->id(), 403);
        $notification->update(['is_read' => true]);
        return back();
    }

    public function markAllRead(Request $request): RedirectResponse
    {
        Notification::where('user_id', $request->user()->id)->update(['is_read' => true]);
        return back();
    }
}
