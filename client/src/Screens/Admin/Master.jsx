import React, { useState, useMemo, useCallback, useEffect } from "react";
import DataTable from "react-data-table-component";
import Swal from "sweetalert2";
import { motion } from "framer-motion";
import { FaEdit, FaFileCsv, FaFileExcel, FaFilePdf, FaTrash } from "react-icons/fa";
import { FiSearch } from "react-icons/fi";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Loader from "../../Components/Admin/Loader";
import axios from "axios";

function Master() {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // ================= FETCH API =================
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const res = await axios.get(`${process.env.REACT_APP_API_URL}/pgc-api/iot/all`)
        setData(res.data?.data || []);
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ================= FILTER =================
  const filteredData = useMemo(() => {
    return data.filter((item) =>
      `${item.deviceId} ${item.level} ${item.temperature}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [data, search]);

  // ================= EXPORT DATA =================
  const getExportData = useCallback(() => {
    return selectedRows.length ? selectedRows : filteredData;
  }, [selectedRows, filteredData]);

  // ================= CSV (NO CHANGE UI) =================
  const downloadCSV = useCallback(() => {
    const rows = getExportData();

    const headers = ["Device ID", "Level", "Temperature", "Created At"];

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        [
          row.deviceId,
          row.level,
          row.temperature,
          row.createdAt,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "iot-data.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, [getExportData]);

  // ================= EXCEL (FIXED) =================
  const exportExcel = useCallback(() => {
    const rows = getExportData();

    const formattedData = rows.map((row) => ({
      "Device ID": row.deviceId,
      "Level": row.level,
      "Temperature": row.temperature,
      "Created At": row.createdAt,
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "IoT Data");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const file = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });

    saveAs(file, `iot-data-${Date.now()}.xlsx`);
  }, [getExportData]);

  // ================= PDF =================
  const exportPDF = useCallback(() => {
    const rows = getExportData();

    const doc = new jsPDF();

    const tableData = rows.map((r) => [
      r.deviceId,
      r.level,
      r.temperature,
      new Date(r.createdAt).toLocaleString(),
    ]);

    autoTable(doc, {
      head: [["Device ID", "Level", "Temperature", "Created At"]],
      body: tableData,
    });

    doc.save(`iot-data-${Date.now()}.pdf`);
  }, [getExportData]);

  // ================= DELETE =================
  const handleDelete = useCallback(async (row) => {
    if (!row?._id) return;

    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This record will be permanently deleted!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
      buttonsStyling: false,
      customClass: {
        confirmButton:
          "bg-red-500 hover:bg-red-600 text-white font-semibold px-5 py-2 rounded-lg mx-2 transition-all duration-200",
        cancelButton:
          "bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-5 py-2 rounded-lg mx-2 transition-all duration-200",
      },
    });

    if (!result.isConfirmed) return;

    try {
      //  API CALL (DELETE)
      await axios.delete(
        `${process.env.REACT_APP_API_URL}/pgc-api/iot/${row._id}`
      );
      //  update UI after success
      setData((prev) => prev.filter((item) => item._id !== row._id));

      Swal.fire({
        title: "Deleted!",
        text: "Record has been deleted.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Delete error:", error);

      Swal.fire({
        title: "Error!",
        text: "Failed to delete record.",
        icon: "error",
      });
    }
  }, []);

  // ================= UPDATE =================
  const handleUpdate = useCallback((row) => {
    Swal.fire({
      title: "Update Level",
      input: "number",
      inputValue: row.level,
      showCancelButton: true,
      buttonsStyling: false,
      customClass: {
        confirmButton:
          "bg-green-500 hover:bg-green-600 text-white font-semibold px-5 py-2 rounded-lg mx-2 transition-all duration-200",
        cancelButton:
          "bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-5 py-2 rounded-lg mx-2 transition-all duration-200",
      },
    }).then((res) => {
      if (res.isConfirmed) {
        setData((prev) =>
          prev.map((item) =>
            item._id === row._id
              ? { ...item, level: res.value }
              : item
          )
        );
      }
    });
  }, []);

  // ================= COLUMNS (ONLY FIELD CHANGE) =================
  const columns = useMemo(
    () => [
      {
        name: "Device ID",
        selector: (row) => row.deviceId,
        sortable: true,
        cell: (row) => (
          <span className="font-semibold text-blue-600">
            {row.deviceId}
          </span>
        ),
      },
      {
        name: "Level",
        selector: (row) => row.level,
        sortable: true,
        cell: (row) => (
          <span className="text-green-600 font-medium">
            {row.level} %
          </span>
        ),
      },
      {
        name: "Temperature",
        selector: (row) => row.temperature,
        sortable: true,
        cell: (row) => (
          <span className="text-purple-600">
            {row.temperature} °C
          </span>
        ),
      },
      {
        name: "Created At",
        selector: (row) => row.createdAt,
        sortable: true,
        cell: (row) => (
          <span className="text-gray-600 text-xs">
            {new Date(row.createdAt).toLocaleString()}
          </span>
        ),
      },
      {
        name: "Actions",
        cell: (row) => (
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.2 }}
              onClick={() => handleUpdate(row)}
              className="text-blue-500"
            >
              <FaEdit size={16} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.2 }}
              onClick={() => handleDelete(row)}
              className="text-red-500"
            >
              <FaTrash size={16} />
            </motion.button>
          </div>
        ),
      },
    ],
    [handleDelete, handleUpdate]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">

      {/* Loader */}

      {/* HEADER (UNCHANGED) */}
      <div className="sticky top-0 md:top-24 z-10 backdrop-blur-xl bg-white/70 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">

          {/* Export Buttons (UNCHANGED UI) */}
          <div className="flex gap-2">

            <motion.button onClick={downloadCSV} className="flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-2 rounded-xl text-xs sm:text-sm shadow border">
              <FaFileCsv size={14} /> CSV
            </motion.button>

            <motion.button onClick={exportExcel} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-xl text-xs sm:text-sm shadow border">
              <FaFileExcel size={14} /> Excel
            </motion.button>

            <motion.button onClick={exportPDF} className="flex items-center gap-2 bg-rose-50 text-rose-600 px-3 py-2 rounded-xl text-xs sm:text-sm shadow border">
              <FaFilePdf size={14} /> PDF
            </motion.button>

          </div>

          {/* SEARCH (UNCHANGED) */}
          <div className="flex items-center bg-white px-3 py-2 rounded-xl shadow-md w-full sm:w-72 border">
            <FiSearch className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search..."
              className="outline-none w-full text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

        </div>
      </div>

      {/* TABLE */}
      <div className="w-full mx-auto mt-4">
        <motion.div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-2 sm:p-4 overflow-x-auto">{loading && <Loader />}
          <DataTable
            columns={columns}
            data={filteredData}
            pagination
            selectableRows
            onSelectedRowsChange={(state) =>
              setSelectedRows(state.selectedRows)
            }
            highlightOnHover
            striped
            responsive
          />

        </motion.div>
      </div>
    </div>
  );
}

export default Master;