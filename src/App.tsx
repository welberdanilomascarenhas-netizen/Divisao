import { useState, useEffect, useMemo, FormEvent } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, Timestamp, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Transaction } from './types';
import { Pencil, Save, X, Trash2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('');
  const [observation, setObservation] = useState('');
  const [loading, setLoading] = useState(true);
  const [splitType, setSplitType] = useState<Transaction['splitType']>('equal');
  const [person1Split, setPerson1Split] = useState('50');

  const [person1Name, setPerson1Name] = useState('Pessoa 1');
  const [person2Name, setPerson2Name] = useState('Pessoa 2');
  const [paidBy, setPaidBy] = useState('');

  const [isEditingNames, setIsEditingNames] = useState(false);
  const [tempPerson1Name, setTempPerson1Name] = useState('');
  const [tempPerson2Name, setTempPerson2Name] = useState('');

  const [isNameSectionCollapsed, setIsNameSectionCollapsed] = useState(true);

  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [tempEditAmount, setTempEditAmount] = useState('');
  const [tempEditObservation, setTempEditObservation] = useState('');

  useEffect(() => {
    const namesDocRef = doc(db, 'config', 'names');
    const unsubscribe = onSnapshot(namesDocRef, (doc) => {
      if (doc.exists()) {
        const names = doc.data();
        setPerson1Name(names.person1Name);
        setPerson2Name(names.person2Name);
        setTempPerson1Name(names.person1Name);
        setTempPerson2Name(names.person2Name);
        if (!paidBy) setPaidBy(names.person1Name);
      } else {
        setDoc(namesDocRef, { person1Name: 'Pessoa 1', person2Name: 'Pessoa 2' });
      }
    });
    return () => unsubscribe();
  }, [paidBy]);

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const transactionsData: Transaction[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        transactionsData.push({
          id: doc.id,
          amount: data.amount,
          paidBy: data.paidBy,
          observation: data.observation,
          timestamp: data.timestamp.toDate(),
          deleted: data.deleted || false,
          splitType: data.splitType || 'equal',
          person1Split: data.person1Split,
        });
      });
      setTransactions(transactionsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const balance = useMemo(() => {
    return transactions
      .filter(tx => !tx.deleted)
      .reduce((acc, tx) => {
        let person1Contribution = 0;
        switch (tx.splitType) {
          case 'equal':
            person1Contribution = tx.amount / 2;
            break;
          case 'full':
            person1Contribution = tx.paidBy === person1Name ? tx.amount : 0;
            break;
          case 'percentage':
            person1Contribution = tx.amount * ((tx.person1Split || 50) / 100);
            break;
        }
        const person2Contribution = tx.amount - person1Contribution;

        if (tx.paidBy === person1Name) {
          return acc + person2Contribution;
        } else {
          return acc - person1Contribution;
        }
      }, 0);
  }, [transactions, person1Name]);

  const handleAddTransaction = async (e: FormEvent) => {
    e.preventDefault();
    const amountNumber = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNumber) || amountNumber <= 0) {
      alert('Por favor, insira um valor válido.');
      return;
    }

    const person1SplitNumber = parseFloat(person1Split);
    if (splitType === 'percentage' && (isNaN(person1SplitNumber) || person1SplitNumber < 0 || person1SplitNumber > 100)) {
        alert('Por favor, insira uma porcentagem válida (0-100).');
        return;
    }

    try {
      await addDoc(collection(db, 'transactions'), {
        amount: amountNumber,
        paidBy,
        observation,
        timestamp: Timestamp.now(),
        deleted: false,
        splitType,
        ...(splitType === 'percentage' && { person1Split: person1SplitNumber }),
      });
      setAmount('');
      setObservation('');
      setSplitType('equal');
      setPerson1Split('50');
    } catch (error) {
      console.error('Erro ao adicionar transação: ', error);
      alert('Falha ao adicionar transação.');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta transação?')) {
      const transactionDoc = doc(db, 'transactions', id);
      try {
        await updateDoc(transactionDoc, { deleted: true });
      } catch (error) {
        console.error('Erro ao excluir transação: ', error);
        alert('Falha ao excluir transação.');
      }
    }
  };

  const handleRestoreTransaction = async (id: string) => {
    const transactionDoc = doc(db, 'transactions', id);
    try {
      await updateDoc(transactionDoc, { deleted: false });
    } catch (error) {
      console.error('Erro ao restaurar transação: ', error);
      alert('Falha ao restaurar transação.');
    }
  };

  const handleSaveNames = async () => {
    const namesDocRef = doc(db, 'config', 'names');
    try {
      await setDoc(namesDocRef, { person1Name: tempPerson1Name, person2Name: tempPerson2Name });
      setIsEditingNames(false);
    } catch (error) {
      console.error('Erro ao salvar nomes: ', error);
      alert('Falha ao salvar nomes.');
    }
  };

  const handleCancelEditNames = () => {
    setTempPerson1Name(person1Name);
    setTempPerson2Name(person2Name);
    setIsEditingNames(false);
  };

  const handleStartEdit = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setTempEditAmount(String(tx.amount).replace('.', ','));
    setTempEditObservation(tx.observation);
  };

  const handleCancelEdit = () => {
    setEditingTxId(null);
  };

  const handleUpdateTransaction = async () => {
    if (!editingTxId) return;

    const amountNumber = parseFloat(tempEditAmount.replace(',', '.'));
    if (isNaN(amountNumber) || amountNumber <= 0) {
      alert('Por favor, insira um valor válido para a edição.');
      return;
    }

    const transactionDoc = doc(db, 'transactions', editingTxId);
    try {
      await updateDoc(transactionDoc, {
        amount: amountNumber,
        observation: tempEditObservation,
      });
      setEditingTxId(null);
    } catch (error) {
      console.error('Erro ao atualizar transação: ', error);
      alert('Falha ao atualizar transação.');
    }
  };

  const getBalanceMessage = () => {
    const formattedBalance = `R$${Math.abs(balance).toFixed(2).replace('.', ',')}`;
    if (balance > 0) {
      return `${person2Name} deve a ${person1Name} ${formattedBalance}`;
    }
    if (balance < 0) {
      return `${person1Name} deve a ${person2Name} ${formattedBalance}`;
    }
    return 'Tudo certo!';
  };

  const getSplitTypeLabel = (tx: Transaction) => {
    switch (tx.splitType) {
      case 'full':
        return 'Inteiro';
      case 'percentage':
        const p2Split = 100 - (tx.person1Split || 0);
        return `Porcentagem (${tx.person1Split}/${p2Split})`;
      case 'equal':
      default:
        return 'Dividido';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 font-sans">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-slate-800">Racha Contas</h1>
        <p className="text-slate-500 mt-2">Acompanhe despesas compartilhadas entre duas pessoas.</p>
      </header>

      <div className="bg-white p-6 rounded-2xl shadow-md mb-8">
        <div 
          className="flex justify-between items-center cursor-pointer" 
          onClick={() => setIsNameSectionCollapsed(!isNameSectionCollapsed)}
        >
          <h2 className="text-lg font-semibold text-slate-700">Nomes</h2>
          <button className="text-slate-500 hover:text-indigo-600">
            {isNameSectionCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </button>
        </div>

        {!isNameSectionCollapsed && (
          <div className="mt-4">
            {isEditingNames ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={tempPerson1Name}
                  onChange={(e) => setTempPerson1Name(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <input
                  type="text"
                  value={tempPerson2Name}
                  onChange={(e) => setTempPerson2Name(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <div className="col-span-1 sm:col-span-2 flex justify-end gap-2 mt-2">
                  <button onClick={handleSaveNames} className="p-2 text-slate-500 hover:text-green-600"><Save size={20} /></button>
                  <button onClick={handleCancelEditNames} className="p-2 text-slate-500 hover:text-red-600"><X size={20} /></button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-grow">
                      <p className="font-medium text-slate-800 truncate">{person1Name}</p>
                      <p className="font-medium text-slate-800 truncate">{person2Name}</p>
                  </div>
                  <button onClick={() => setIsEditingNames(true)} className="text-slate-500 hover:text-indigo-600 ml-4 flex-shrink-0">
                    <Pencil size={18} />
                  </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-md mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-2">Saldo Atual</h2>
        <p className={`text-2xl font-bold ${balance === 0 ? 'text-green-600' : 'text-slate-800'}`}>
          {getBalanceMessage()}
        </p>
      </div>

      <form onSubmit={handleAddTransaction} className="bg-white p-6 rounded-2xl shadow-md mb-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Adicionar Nova Transação</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-slate-600 mb-1">Valor</label>
            <input
              id="amount"
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Pago por</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPaidBy(person1Name)} className={`w-full py-2 rounded-md text-sm font-semibold transition-colors ${paidBy === person1Name ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>{person1Name}</button>
              <button type="button" onClick={() => setPaidBy(person2Name)} className={`w-full py-2 rounded-md text-sm font-semibold transition-colors ${paidBy === person2Name ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>{person2Name}</button>
            </div>
          </div>
        </div>
        <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">Tipo de Divisão</label>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setSplitType('equal')} className={`py-2 rounded-md text-sm font-semibold transition-colors ${splitType === 'equal' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>Igual</button>
              <button type="button" onClick={() => setSplitType('full')} className={`py-2 rounded-md text-sm font-semibold transition-colors ${splitType === 'full' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>Inteiro</button>
              <button type="button" onClick={() => setSplitType('percentage')} className={`py-2 rounded-md text-sm font-semibold transition-colors ${splitType === 'percentage' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>Porcentagem</button>
            </div>
        </div>
        {splitType === 'percentage' && (
            <div className="mb-4 grid grid-cols-2 gap-4 items-center">
                <div>
                    <label htmlFor="person1Split" className="block text-sm font-medium text-slate-600 mb-1">% {person1Name}</label>
                    <input
                        id="person1Split"
                        type="number"
                        value={person1Split}
                        onChange={(e) => setPerson1Split(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">% {person2Name}</label>
                    <p className="w-full px-3 py-2 border border-slate-200 rounded-md bg-slate-50">{100 - parseFloat(person1Split || '0')}</p>
                </div>
            </div>
        )}
        <div className="mb-4">
          <label htmlFor="observation" className="block text-sm font-medium text-slate-600 mb-1">Observação (Opcional)</label>
          <input
            id="observation"
            type="text"
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Ex: Supermercado, Jantar, etc."
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <button type="submit" className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">Adicionar Transação</button>
      </form>

      <div>
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Histórico</h2>
        {loading ? (
          <p className="text-slate-500 text-center">Carregando histórico...</p>
        ) : transactions.length === 0 ? (
          <p className="text-slate-500 text-center">Nenhuma transação ainda.</p>
        ) : (
          <ul className="space-y-3">
            {transactions.map((tx) => (
              <li key={tx.id} className={`bg-white p-4 rounded-lg shadow-sm flex justify-between items-start transition-opacity ${tx.deleted ? 'opacity-50' : ''}`}>
                {editingTxId === tx.id ? (
                  <div className="flex-grow">
                    <input 
                      type="text" 
                      value={tempEditAmount} 
                      onChange={(e) => setTempEditAmount(e.target.value)}
                      className="w-full px-2 py-1 mb-2 border border-slate-300 rounded-md shadow-sm"
                    />
                    <input 
                      type="text" 
                      value={tempEditObservation} 
                      onChange={(e) => setTempEditObservation(e.target.value)}
                      className="w-full px-2 py-1 border border-slate-300 rounded-md shadow-sm"
                    />
                  </div>
                ) : (
                  <div className={`${tx.deleted ? 'line-through text-slate-400' : ''}`}>
                    <p className={`font-semibold ${tx.deleted ? '' : 'text-slate-800'}`}>
                      {tx.paidBy} pagou R${tx.amount.toFixed(2).replace('.', ',')}
                      <span className="text-xs font-normal text-slate-400 ml-2">({getSplitTypeLabel(tx)})</span>
                    </p>
                    {tx.observation && <p className={`text-sm ${tx.deleted ? '' : 'text-slate-500'}`}>{tx.observation}</p>}
                  </div>
                )}
                <div className="flex items-center gap-2 pl-4 flex-shrink-0">
                  {editingTxId === tx.id ? (
                    <>
                      <button onClick={handleUpdateTransaction} className="text-slate-400 hover:text-green-600"><Save size={16} /></button>
                      <button onClick={handleCancelEdit} className="text-slate-400 hover:text-red-600"><X size={16} /></button>
                    </>
                  ) : (
                    <>
                      <p className={`text-xs ${tx.deleted ? 'text-slate-400' : 'text-slate-400'}`}>{tx.timestamp.toLocaleDateString()} {tx.timestamp.toLocaleTimeString()}</p>
                      <button onClick={() => handleStartEdit(tx)} className="text-slate-400 hover:text-indigo-600" title="Editar"><Pencil size={16} /></button>
                      {tx.deleted ? (
                        <button onClick={() => handleRestoreTransaction(tx.id)} className="text-slate-400 hover:text-green-600" title="Restaurar">
                          <RotateCcw size={16} />
                        </button>
                      ) : (
                        <button onClick={() => handleDeleteTransaction(tx.id)} className="text-slate-400 hover:text-red-600" title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
