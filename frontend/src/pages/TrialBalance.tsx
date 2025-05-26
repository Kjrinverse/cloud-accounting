import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../services/api';
import { TrialBalanceItem } from '../types';

const TrialBalance: React.FC = () => {
  const [trialBalanceItems, setTrialBalanceItems] = useState<TrialBalanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [asOfDate, setAsOfDate] = useState<Date | null>(new Date());

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await api.get('/organizations');
        setOrganizations(response.data.data);
        if (response.data.data.length > 0) {
          setSelectedOrganization(response.data.data[0].id);
        }
      } catch (err) {
        setError('Failed to fetch organizations');
      }
    };

    fetchOrganizations();
  }, []);

  useEffect(() => {
    const fetchTrialBalance = async () => {
      if (!selectedOrganization || !asOfDate) return;
      
      try {
        setLoading(true);
        const formattedDate = asOfDate.toISOString().split('T')[0];
        
        const response = await api.get(
          `/organizations/${selectedOrganization}/trial-balance`,
          { params: { asOfDate: formattedDate } }
        );

        setTrialBalanceItems(response.data.data);
        setError('');
      } catch (err) {
        setError('Failed to fetch trial balance data');
      } finally {
        setLoading(false);
      }
    };

    fetchTrialBalance();
  }, [selectedOrganization, asOfDate]);

  const handleOrganizationChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedOrganization(e.target.value as string);
  };

  const calculateTotals = () => {
    let totalDebit = 0;
    let totalCredit = 0;
    
    trialBalanceItems.forEach(item => {
      totalDebit += item.debit || 0;
      totalCredit += item.credit || 0;
    });
    
    return { totalDebit, totalCredit };
  };

  const { totalDebit, totalCredit } = calculateTotals();

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>Trial Balance</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Organization</InputLabel>
              <Select
                value={selectedOrganization}
                label="Organization"
                onChange={handleOrganizationChange}
              >
                {organizations.map((org) => (
                  <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="As of Date"
                value={asOfDate}
                onChange={(date) => setAsOfDate(date)}
                sx={{ width: '100%' }}
              />
            </LocalizationProvider>
          </Grid>
        </Grid>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Account Code</TableCell>
                <TableCell>Account Name</TableCell>
                <TableCell>Account Type</TableCell>
                <TableCell align="right">Debit</TableCell>
                <TableCell align="right">Credit</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trialBalanceItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">No data found</TableCell>
                </TableRow>
              ) : (
                <>
                  {trialBalanceItems.map((item) => (
                    <TableRow key={item.accountId}>
                      <TableCell>{item.accountCode}</TableCell>
                      <TableCell>{item.accountName}</TableCell>
                      <TableCell>{item.accountType}</TableCell>
                      <TableCell align="right">{item.debit > 0 ? `$${item.debit.toFixed(2)}` : ''}</TableCell>
                      <TableCell align="right">{item.credit > 0 ? `$${item.credit.toFixed(2)}` : ''}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ fontWeight: 'bold', bgcolor: 'background.default' }}>
                    <TableCell colSpan={3} align="right">Totals</TableCell>
                    <TableCell align="right">${totalDebit.toFixed(2)}</TableCell>
                    <TableCell align="right">${totalCredit.toFixed(2)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
};

export default TrialBalance;
