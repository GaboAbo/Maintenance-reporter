import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { marginBottom: 24 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#666' },
  period: { fontSize: 10, color: '#888', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20, marginTop: 16 },
  statBox: { flex: 1, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 4 },
  statValue: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  statLabel: { fontSize: 9, color: '#666', marginTop: 2 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  table: { width: '100%' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f5f5f5', paddingVertical: 6, paddingHorizontal: 8 },
  tableHeaderCell: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#444' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tableCell: { fontSize: 9 },
  col35: { width: '35%' },
  col25: { width: '25%' },
  col20: { width: '20%' },
  col15: { width: '15%' },
  empty: { color: '#999', fontSize: 9, fontStyle: 'italic' },
})

export type ReportParams = {
  tenantName: string
  client: { name: string; email: string }
  periodStart: Date
  periodEnd: Date
  assets: Array<{ name: string; category: string | null; location: string | null; status: string }>
  workOrders: Array<{
    type: string
    status: string
    description: string | null
    technicianName: string | null
    completedAt: Date | null
  }>
}

function fmt(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ReportDocument({ tenantName, client, periodStart, periodEnd, assets, workOrders }: ReportParams) {
  const completed = workOrders.filter((wo) => wo.status === 'COMPLETED').length

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{client.name}</Text>
          <Text style={styles.subtitle}>Maintenance Report — {tenantName}</Text>
          <Text style={styles.period}>Period: {fmt(periodStart)} – {fmt(periodEnd)}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{assets.length}</Text>
            <Text style={styles.statLabel}>Assets</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{workOrders.length}</Text>
            <Text style={styles.statLabel}>Work orders</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{completed}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assets</Text>
          {assets.length === 0 ? (
            <Text style={styles.empty}>No assets assigned.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.col35]}>Name</Text>
                <Text style={[styles.tableHeaderCell, styles.col25]}>Category</Text>
                <Text style={[styles.tableHeaderCell, styles.col25]}>Location</Text>
                <Text style={[styles.tableHeaderCell, styles.col15]}>Status</Text>
              </View>
              {assets.map((asset, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col35]}>{asset.name}</Text>
                  <Text style={[styles.tableCell, styles.col25]}>{asset.category ?? '—'}</Text>
                  <Text style={[styles.tableCell, styles.col25]}>{asset.location ?? '—'}</Text>
                  <Text style={[styles.tableCell, styles.col15]}>{asset.status}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Work Orders (this period)</Text>
          {workOrders.length === 0 ? (
            <Text style={styles.empty}>No work orders in this period.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.col35]}>Description</Text>
                <Text style={[styles.tableHeaderCell, styles.col15]}>Type</Text>
                <Text style={[styles.tableHeaderCell, styles.col15]}>Status</Text>
                <Text style={[styles.tableHeaderCell, styles.col20]}>Technician</Text>
                <Text style={[styles.tableHeaderCell, styles.col15]}>Completed</Text>
              </View>
              {workOrders.map((wo, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col35]}>{wo.description ?? '—'}</Text>
                  <Text style={[styles.tableCell, styles.col15]}>{wo.type}</Text>
                  <Text style={[styles.tableCell, styles.col15]}>{wo.status}</Text>
                  <Text style={[styles.tableCell, styles.col20]}>{wo.technicianName ?? '—'}</Text>
                  <Text style={[styles.tableCell, styles.col15]}>{fmt(wo.completedAt)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Page>
    </Document>
  )
}

export async function generateClientReportPdf(params: ReportParams): Promise<Buffer> {
  return renderToBuffer(<ReportDocument {...params} />)
}
