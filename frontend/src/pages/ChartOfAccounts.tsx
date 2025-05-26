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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import api from '../services/api';
import { Account } from '../types';

const ChartOfAccounts: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [organizations, setOrganizations] = useState<any[]>([]);
  
  // New account form state
  const [newAccount, setNewAccount] = useState({
    code: '',
    name: '',
    type: '',
    parentId: ''
  });

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
    const fetchAccounts = async () => {
      if (!selectedOrganization) return;
      
      try {
        setLoading(true);
        const response = await api.get(`/organizations/${selectedOrganization}/accounts`);
        setAccounts(response.data.data);
        setError('');
      } catch (err) {
        setError('Failed to fetch accounts');
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [selectedOrganization]);

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setNewAccount({
      code: '',
      name: '',
      type: '',
      parentId: ''
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setNewAccount({
      ...newAccount,
      [name as string]: value
    });
  };

  const handleSubmit = async () => {
    try {
      const response = await api.post(`/organizations/${selectedOrganization}/accounts`, newAccount);
      setAccounts([...accounts, response.data.data]);
      handleCloseDialog();
    } catch (err) {
      setError('Failed to create account');
    }
  };

  const handleOrganizationChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedOrganization(e.target.value as string);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Chart of Accounts</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
        >
          New Account
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {organizations.length > 0 && (
        <FormControl fullWidth sx={{ mb: 3 }}>
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
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Parent Account</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">No accounts found</TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>{account.code}</TableCell>
                    <TableCell>{account.name}</TableCell>
                    <TableCell>{account.type}</TableCell>
                    <TableCell>
                      {account.parentId ? 
                        accounts.find(a => a.id === account.parentId)?.name || 'Unknown' 
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Create New Account</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            name="code"
            label="Account Code"
            type="text"
            fullWidth
            value={newAccount.code}
            onChange={handleInputChange}
          />
          <TextField
            margin="dense"
            name="name"
            label="Account Name"
            type="text"
            fullWidth
            value={newAccount.name}
            onChange={handleInputChange}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Account Type</InputLabel>
            <Select
              name="type"
              value={newAccount.type}
              label="Account Type"
              onChange={handleInputChange}
            >
              <MenuItem value="ASSET">Asset</MenuItem>
              <MenuItem value="LIABILITY">Liability</MenuItem>
              <MenuItem value="EQUITY">Equity</MenuItem>
              <MenuItem value="REVENUE">Revenue</MenuItem>
              <MenuItem value="EXPENSE">Expense</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Parent Account</InputLabel>
            <Select
              name="parentId"
              value={newAccount.parentId}
              label="Parent Account"
              onChange={handleInputChange}
            >
              <MenuItem value="">None</MenuItem>
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </MenuItem>
              ))}
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

export default ChartOfAccounts;
