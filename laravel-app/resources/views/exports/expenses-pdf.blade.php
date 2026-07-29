<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Expenses export</title>
    <style>
        body { font-family: sans-serif; font-size: 10px; color: #222; }
        h1 { font-size: 14px; margin: 0 0 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f1f5f9; text-align: left; padding: 6px 4px; font-size: 9px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #cbd5e1; }
        td { padding: 5px 4px; border-bottom: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <h1>Expenses — {{ now()->format('d M Y') }}</h1>
    <table>
        <thead><tr><th>Date</th><th>Project</th><th>Category</th><th>Vendor</th><th>Amount</th><th>Stage 1</th><th>Final</th></tr></thead>
        <tbody>
            @foreach($expenses as $e)
                <tr>
                    <td>{{ $e->expense_date->format('d M Y') }}</td>
                    <td>{{ $e->project?->name }}</td>
                    <td>{{ $e->category }}</td>
                    <td>{{ $e->vendor }}</td>
                    <td>₹{{ number_format($e->amount) }}</td>
                    <td>{{ ucfirst($e->stage1_status) }}</td>
                    <td>{{ str_replace('_', ' ', ucfirst($e->final_status)) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
