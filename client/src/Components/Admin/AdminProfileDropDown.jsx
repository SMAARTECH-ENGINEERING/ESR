import React, { useState } from "react";
import {
  Avatar,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  Typography,
  Chip,
} from "@mui/material";

import { motion } from "framer-motion";

import { PiUserCircleDuotone } from "react-icons/pi";
import { RiLogoutCircleRLine } from "react-icons/ri";
import { BiSolidUserCircle } from "react-icons/bi";
import { MdLockReset } from "react-icons/md";

import { useNavigate } from "react-router-dom";

const AdminProfileDropDown = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();

  const user = {
    name: "Jagadish Behera",
    email: "admin@gmail.com",
    role: "Admin", //  role badge
    image: "",
  };

  const open = Boolean(anchorEl);

  const handleOpen = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleLogout = () => {
    handleClose();
    localStorage.clear();
    navigate("/");
  };

  const handleProfile = () => {
    handleClose();
    navigate("/profile");
  };

  const handleForgotPassword = () => {
    handleClose();
    navigate("/forgot-password");
  };

  return (
    <div>
      {/* Avatar */}
      {user.image ? (
        <Avatar
          onClick={handleOpen}
          src={user.image}
          sx={{
            width: 42,
            height: 42,
            cursor: "pointer",
            transition: "0.3s",
            "&:hover": { transform: "scale(1.05)" },
          }}
        />
      ) : (
        <PiUserCircleDuotone
          onClick={handleOpen}
          size={42}
          className="cursor-pointer transition hover:text-[#2E3A8C]"
        />
      )}

      {/* Animated Menu */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 260,
            borderRadius: 3,
            overflow: "hidden",
            mt: 1,
          },
        }}
      >
        {/*  Framer Motion Wrapper */}
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          {/* Header */}
          <div className="px-3 py-3 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Typography fontWeight={600} fontSize={15}>
                {user.name}
              </Typography>

              {/*  Role Badge */}
              <Chip
                label={user.role}
                size="small"
                color="primary"
                sx={{
                  height: 20,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
            </div>

            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
          </div>

          <Divider />

          {/* Profile */}
          <MenuItem onClick={handleProfile} sx={{ py: 1.2 }}>
            <ListItemIcon>
              <BiSolidUserCircle size={20} />
            </ListItemIcon>
            Profile
          </MenuItem>

          {/* Change Password */}
          <MenuItem onClick={handleForgotPassword} sx={{ py: 1.2 }}>
            <ListItemIcon>
              <MdLockReset size={20} color="#f59e0b" />
            </ListItemIcon>
            Change Password
          </MenuItem>

          <Divider />

          {/* Logout */}
          <MenuItem
            onClick={handleLogout}
            sx={{
              py: 1.2,
              color: "red",
              "&:hover": { backgroundColor: "#fff1f2" },
            }}
          >
            <ListItemIcon>
              <RiLogoutCircleRLine size={20} color="red" />
            </ListItemIcon>
            Logout
          </MenuItem>
        </motion.div>
      </Menu>
    </div>
  );
};

export default AdminProfileDropDown;