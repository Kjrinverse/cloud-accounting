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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../services/api';
import { Organization } from '../types';

const Organizations: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  
  // New organization form state
  const [newOrganization, setNewOrganization] = useState({
    name: '',
    fiscalYearStart: new Date(),
    currency: 'USD'
  });

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        setLoading(true);
        const response = await api.get('/organizations');
        setOrganizations(response.data.data);
        setError('');
      } catch (err) {
        setError('Failed to fetch organizations');
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, []);

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setNewOrganization({
      name: '',
      fiscalYearStart: new Date(),
      currency: 'USD'
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setNewOrganization({
      ...newOrganization,
      [name as string]: value
    });
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setNewOrganization({
        ...newOrganization,
        fiscalYearStart: date
      });
    }
  };

  const handleSubmit = async () => {
    try {
      const response = await api.post('/organizations', {
        ...newOrganization,
        fiscalYearStart: newOrganization.fiscalYearStart.toISOString().split('T')[0]
      });
      setOrganizations([...organizations, response.data.data]);
      handleCloseDialog();
    } catch (err) {
      setError('Failed to create organization');
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Organizations</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
        >
          New Organization
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Fiscal Year Start</TableCell>
                <TableCell>Currency</TableCell>
                <TableCell>Created At</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {organizations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">No organizations found</TableCell>
                </TableRow>
              ) : (
                organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>{org.name}</TableCell>
                    <TableCell>{new Date(org.fiscalYearStart).toLocaleDateString()}</TableCell>
                    <TableCell>{org.currency}</TableCell>
                    <TableCell>{new Date(org.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Create New Organization</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            name="name"
            label="Organization Name"
            type="text"
            fullWidth
            value={newOrganization.name}
            onChange={handleInputChange}
          />
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Fiscal Year Start"
              value={newOrganization.fiscalYearStart}
              onChange={handleDateChange}
              sx={{ width: '100%', mt: 2 }}
            />
          </LocalizationProvider>
          <FormControl fullWidth margin="dense">
            <InputLabel>Currency</InputLabel>
            <Select
              name="currency"
              value={newOrganization.currency}
              label="Currency"
              onChange={handleInputChange}
            >
              <MenuItem value="USD">USD - US Dollar</MenuItem>
              <MenuItem value="EUR">EUR - Euro</MenuItem>
              <MenuItem value="GBP">GBP - British Pound</MenuItem>
              <MenuItem value="CAD">CAD - Canadian Dollar</MenuItem>
              <MenuItem value="AUD">AUD - Australian Dollar</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} color="primary">Create</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Organizations;
