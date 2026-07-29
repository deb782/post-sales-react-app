<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Units export</title>
    <style>
        body { font-family: sans-serif; font-size: 10px; color: #222; }
        h1 { font-size: 14px; margin: 0 0 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f1f5f9; text-align: left; padding: 6px 4px; font-size: 9px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #cbd5e1; }
        td { padding: 5px 4px; border-bottom: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <h1>Units — {{ now()->format('d M Y') }}</h1>
    <table>
        <thead><tr><th>Project</th><th>Unit #</th><th>Price</th><th>Status</th><th>Buyer</th><th>Sold on</th></tr></thead>
        <tbody>
            @foreach($units as $u)
                <tr>
                    <td>{{ $u->project?->name }}</td>
                    <td>{{ $u->unit_number }}</td>
                    <td>₹{{ number_format($u->price) }}</td>
                    <td>{{ ucfirst($u->status) }}</td>
                    <td>{{ $u->buyer_name }}</td>
                    <td>{{ $u->sold_at?->format('d M Y') }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
